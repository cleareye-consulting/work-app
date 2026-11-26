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
import { addWorkItemDocument, workItemExists } from '$lib/server/repositories/workItemRepository';
import { generateDocumentSummary } from '$lib/server/ai';
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
