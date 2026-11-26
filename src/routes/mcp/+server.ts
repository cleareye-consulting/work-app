import { env } from '$env/dynamic/private';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
	createMcpHandler,
	hostHeaderValidationResponse,
	localhostAllowedHostnames,
	localhostAllowedOrigins,
	McpServer,
	originValidationResponse
} from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { getWorkItemContext } from '$lib/server/repositories/workItemContextRepository';
import {
	addWorkItem,
	addWorkItemDocument,
	getChildWorkItems,
	getWorkItemById,
	updateWorkItem,
	workItemExists
} from '$lib/server/repositories/workItemRepository';
import { generateDocumentSummary } from '$lib/server/ai';
import { getClientName } from '$lib/server/repositories/clientRepository';
import { workItemStatuses, workItemTypes } from '$lib/server/utils';
import type { RequestHandler } from './$types';

const handler = createMcpHandler(() => {
	const server = new McpServer({ name: 'cleareye-work-app', version: '1.0.0' });
	server.registerTool(
		'get_work_item_context',
		{
			description:
				'Read a work item by ID, including its ancestors, descendants, documents, change history, and time entries.',
			inputSchema: z.object({ workItemId: z.number().int().positive() }),
			annotations: { readOnlyHint: true }
		},
		async ({ workItemId }) => {
			const context = await getWorkItemContext(workItemId);
			if (!context) {
				return {
					isError: true,
					content: [{ type: 'text', text: `Work item ${workItemId} not found.` }]
				};
			}
			return { content: [{ type: 'text', text: JSON.stringify(context) }] };
		}
	);
	server.registerTool(
		'add_work_item',
		{
			description:
				'Create a STORY under a FEATURE, or an NFR or BUG under a parent allowed by the work item type rules. Starts in NEW status. Use update_work_item afterward to set custom fields.',
			inputSchema: z.strictObject({
				type: z.enum(['STORY', 'NFR', 'BUG']),
				parentId: z.number().int().positive(),
				name: z.string().trim().min(1).max(200),
				description: z.string().max(200_000).optional()
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
		},
		async ({ type, parentId, name, description }) => {
			if (!(await workItemExists(parentId))) {
				return {
					isError: true,
					content: [{ type: 'text', text: `Parent work item ${parentId} not found.` }]
				};
			}
			const parent = await getWorkItemById(parentId);
			if (
				!workItemTypes[type].parentTypes.includes(parent.type) ||
				(type === 'STORY' && parent.type !== 'FEATURE')
			) {
				return {
					isError: true,
					content: [{ type: 'text', text: `${type} cannot be created under a ${parent.type}.` }]
				};
			}
			const workItemId = await addWorkItem({
				name,
				description,
				type,
				status: 'NEW',
				clientId: parent.clientId,
				clientName: parent.clientName,
				parentId,
				customFields: {}
			});
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							workItemId,
							type,
							status: 'NEW',
							clientId: parent.clientId,
							parentId,
							url: `/work-items/${workItemId}`
						})
					}
				]
			};
		}
	);
	server.registerTool(
		'update_work_item',
		{
			description:
				'Update a work item’s status, type, client, parent, or custom fields (including a FEATURE’s roadmap). Name and description cannot be changed. Omitted fields are preserved; set a custom field to null to clear it.',
			inputSchema: z.strictObject({
				workItemId: z.number().int().positive(),
				status: z.string().optional(),
				type: z.string().optional(),
				clientId: z.number().int().positive().optional(),
				parentId: z.number().int().positive().nullable().optional(),
				customFields: z
					.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
					.optional()
			}),
			annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
		},
		async ({ workItemId, status, type, clientId, parentId, customFields }) => {
			const error = (message: string) => ({
				isError: true,
				content: [{ type: 'text' as const, text: message }]
			});
			if (
				status === undefined &&
				type === undefined &&
				clientId === undefined &&
				parentId === undefined &&
				customFields === undefined
			) {
				return error('Provide at least one field to update.');
			}
			if (!(await workItemExists(workItemId))) return error(`Work item ${workItemId} not found.`);

			const item = await getWorkItemById(workItemId);
			const nextType = type ?? item.type;
			const nextClientId = clientId ?? item.clientId;
			let nextClientName = item.clientName;
			if (clientId !== undefined && clientId !== item.clientId) {
				try {
					nextClientName = await getClientName(clientId);
				} catch {
					return error(`Client ${clientId} not found.`);
				}
			}
			const typeInfo = workItemTypes[nextType];
			if (!typeInfo) return error(`Unknown work item type: ${nextType}.`);
			if (status !== undefined && !workItemStatuses.includes(status)) {
				return error(`Unknown work item status: ${status}.`);
			}

			const nextParentId = parentId === undefined ? item.parentId : (parentId ?? undefined);
			if (nextParentId === workItemId) return error('A work item cannot be its own parent.');
			if (
				(parentId !== undefined || type !== undefined || clientId !== undefined) &&
				nextParentId !== undefined
			) {
				const parentContext = await getWorkItemContext(nextParentId);
				if (!parentContext) return error(`Parent work item ${nextParentId} not found.`);
				if (parentContext.workItem.clientId !== nextClientId) {
					return error('Parent and child must belong to the same client.');
				}
				if (!typeInfo.parentTypes.includes(parentContext.workItem.type)) {
					return error(`${nextType} cannot have a ${parentContext.workItem.type} parent.`);
				}
				if (parentContext.ancestors.some((ancestor) => ancestor.id === workItemId)) {
					return error('A work item cannot be moved beneath its descendant.');
				}
			} else if (
				(parentId !== undefined || type !== undefined || clientId !== undefined) &&
				!typeInfo.parentTypes.includes('_CLIENT_')
			) {
				return error(`${nextType} requires a parent work item.`);
			}

			if (type !== undefined && type !== item.type) {
				const children = await getChildWorkItems(item, null);
				const incompatible = children.find(
					(child) => !workItemTypes[child.type]?.parentTypes.includes(nextType)
				);
				if (incompatible)
					return error(
						`${incompatible.type} child ${incompatible.id} cannot have a ${nextType} parent.`
					);
			}

			const allowedFields = new Map(typeInfo.customFields.map((field) => [field.name, field]));
			const nextFields: Record<string, unknown> =
				type !== undefined && type !== item.type
					? Object.fromEntries(
							Object.entries(item.customFields).filter(([key]) => allowedFields.has(key))
						)
					: { ...item.customFields };
			for (const [key, value] of Object.entries(customFields ?? {})) {
				const definition = allowedFields.get(key);
				if (!definition) return error(`${key} is not a custom field on ${nextType}.`);
				if (value === null) {
					if (definition.required) return error(`${key} is required on ${nextType}.`);
					delete nextFields[key];
					continue;
				}
				if (definition.type === 'number' ? typeof value !== 'number' : typeof value !== 'string') {
					return error(`${key} must be a ${definition.type}.`);
				}
				if (definition.values && !definition.values.includes(value as never)) {
					return error(`${key} must be one of: ${definition.values.join(', ')}.`);
				}
				nextFields[key] = value;
			}
			for (const field of typeInfo.customFields) {
				if (
					field.required &&
					(nextFields[field.name] === undefined || nextFields[field.name] === '')
				) {
					return error(`${field.name} is required on ${nextType}.`);
				}
			}

			await updateWorkItem({
				...item,
				type: nextType,
				status: status ?? item.status,
				clientId: nextClientId,
				clientName: nextClientName,
				parentId: nextParentId,
				customFields: nextFields
			});
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							workItemId,
							type: nextType,
							status: status ?? item.status,
							clientId: nextClientId,
							parentId: nextParentId ?? null,
							customFields: nextFields
						})
					}
				]
			};
		}
	);
	server.registerTool(
		'add_work_item_note',
		{
			description: 'Add a Markdown note as a document to an existing work item.',
			inputSchema: z.object({
				workItemId: z.number().int().positive(),
				name: z.string().trim().min(1).max(200),
				content: z.string().trim().min(1).max(200_000)
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
		},
		async ({ workItemId, name, content }) => {
			if (!(await workItemExists(workItemId))) {
				return {
					isError: true,
					content: [{ type: 'text', text: `Work item ${workItemId} not found.` }]
				};
			}

			const summary = await generateDocumentSummary(content);
			const documentId = await addWorkItemDocument({
				workItemId,
				name,
				type: 'text/markdown',
				content,
				summary
			});
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							workItemId,
							documentId,
							name,
							summary,
							url: `/work-items/${workItemId}/documents/${documentId}`
						})
					}
				]
			};
		}
	);
	return server;
});

function authorized(request: Request): boolean {
	const expected = env.WORK_APP_MCP_TOKEN;
	if (!expected || expected.length < 32) return false;
	const match = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '');
	if (!match) return false;
	const expectedHash = createHash('sha256').update(expected).digest();
	const suppliedHash = createHash('sha256').update(match[1]).digest();
	return timingSafeEqual(expectedHash, suppliedHash);
}

const serve: RequestHandler = async ({ request }) => {
	const rejected =
		hostHeaderValidationResponse(request, localhostAllowedHostnames()) ??
		originValidationResponse(request, localhostAllowedOrigins());
	if (rejected) return rejected;
	if (!env.WORK_APP_MCP_TOKEN || env.WORK_APP_MCP_TOKEN.length < 32) {
		return new Response('MCP token is not configured.', { status: 503 });
	}
	if (!authorized(request)) {
		return new Response('Unauthorized', {
			status: 401,
			headers: { 'WWW-Authenticate': 'Bearer' }
		});
	}
	return handler.fetch(request);
};

export const GET = serve;
export const POST = serve;
export const DELETE = serve;
