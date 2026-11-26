import { beforeEach, expect, it, vi } from 'vitest';

const token = 'a'.repeat(64);
vi.mock('$env/dynamic/private', () => ({ env: { WORK_APP_MCP_TOKEN: 'a'.repeat(64) } }));
vi.mock('$lib/server/repositories/workItemContextRepository', () => ({
	getWorkItemContext: vi.fn()
}));
vi.mock('$lib/server/repositories/workItemRepository', () => ({
	workItemExists: vi.fn(),
	addWorkItemDocument: vi.fn(),
	getWorkItemById: vi.fn(),
	getChildWorkItems: vi.fn(),
	updateWorkItem: vi.fn()
}));
vi.mock('$lib/server/ai', () => ({ generateDocumentSummary: vi.fn() }));
vi.mock('$lib/server/repositories/clientRepository', () => ({ getClientName: vi.fn() }));

import { getWorkItemContext } from '$lib/server/repositories/workItemContextRepository';
import {
	addWorkItemDocument,
	getChildWorkItems,
	getWorkItemById,
	updateWorkItem,
	workItemExists
} from '$lib/server/repositories/workItemRepository';
import { generateDocumentSummary } from '$lib/server/ai';
import { getClientName } from '$lib/server/repositories/clientRepository';
import { POST } from './+server';

const mockedGetContext = vi.mocked(getWorkItemContext);
const mockedWorkItemExists = vi.mocked(workItemExists);
const mockedAddDocument = vi.mocked(addWorkItemDocument);
const mockedGetItem = vi.mocked(getWorkItemById);
const mockedGetChildren = vi.mocked(getChildWorkItems);
const mockedUpdateItem = vi.mocked(updateWorkItem);
const mockedGenerateSummary = vi.mocked(generateDocumentSummary);
const mockedGetClientName = vi.mocked(getClientName);

function request(
	authorization?: string,
	name = 'get_work_item_context',
	args: Record<string, unknown> = { workItemId: 42 }
) {
	return new Request('http://127.0.0.1:5173/mcp', {
		method: 'POST',
		headers: {
			Host: '127.0.0.1:5173',
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			...(authorization ? { Authorization: authorization } : {})
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method: 'tools/call',
			params: { name, arguments: args }
		})
	});
}

async function result(response: Response) {
	const body = await response.text();
	return JSON.parse(body.startsWith('event:') ? body.match(/^data: (.*)$/m)![1] : body);
}

beforeEach(() => {
	mockedGetContext.mockReset();
	mockedWorkItemExists.mockReset();
	mockedAddDocument.mockReset();
	mockedGetItem.mockReset();
	mockedGetChildren.mockReset();
	mockedUpdateItem.mockReset();
	mockedGenerateSummary.mockReset();
	mockedGetClientName.mockReset();
});

it('updates a FEATURE roadmap and status while preserving its name and description', async () => {
	mockedWorkItemExists.mockResolvedValue(true);
	mockedGetItem.mockResolvedValue({
		id: 42,
		name: 'Feature name',
		description: 'Human description',
		type: 'FEATURE',
		status: 'NEW',
		clientId: 1,
		clientName: 'Client',
		parentId: 7,
		customFields: { roadmap: 'Old plan' }
	});
	mockedGetContext.mockResolvedValue({
		workItem: { id: 7, type: 'PROJECT', clientId: 1 },
		ancestors: []
	} as never);
	const response = await POST({
		request: request(`Bearer ${token}`, 'update_work_item', {
			workItemId: 42,
			status: 'PLANNING',
			customFields: { roadmap: '## Next quarter\nShip reporting' }
		})
	} as never);
	expect((await result(response)).result.isError).toBeFalsy();
	expect(mockedUpdateItem).toHaveBeenCalledWith({
		id: 42,
		name: 'Feature name',
		description: 'Human description',
		type: 'FEATURE',
		status: 'PLANNING',
		clientId: 1,
		clientName: 'Client',
		parentId: 7,
		customFields: { roadmap: '## Next quarter\nShip reporting' }
	});
});

it('rejects changes to name and description and unknown custom fields', async () => {
	const renamed = await result(
		await POST({
			request: request(`Bearer ${token}`, 'update_work_item', { workItemId: 42, name: 'Changed' })
		} as never)
	);
	expect(renamed.error ?? renamed.result?.isError).toBeTruthy();
	const rewritten = await result(
		await POST({
			request: request(`Bearer ${token}`, 'update_work_item', {
				workItemId: 42,
				description: 'Changed'
			})
		} as never)
	);
	expect(rewritten.error ?? rewritten.result?.isError).toBeTruthy();
	expect(mockedUpdateItem).not.toHaveBeenCalled();

	mockedWorkItemExists.mockResolvedValue(true);
	mockedGetItem.mockResolvedValue({
		id: 42,
		name: 'Feature',
		type: 'FEATURE',
		status: 'NEW',
		clientId: 1,
		clientName: 'Client',
		parentId: 7,
		customFields: {}
	});
	mockedGetContext.mockResolvedValue({
		workItem: { id: 7, type: 'PROJECT', clientId: 1 },
		ancestors: []
	} as never);
	const unknown = await result(
		await POST({
			request: request(`Bearer ${token}`, 'update_work_item', {
				workItemId: 42,
				customFields: { secret: 'value' }
			})
		} as never)
	);
	expect(unknown.result.isError).toBe(true);
	expect(mockedUpdateItem).not.toHaveBeenCalled();
});

it('rejects a parent change that would create a cycle', async () => {
	mockedWorkItemExists.mockResolvedValue(true);
	mockedGetItem.mockResolvedValue({
		id: 42,
		name: 'Project',
		type: 'PROJECT',
		status: 'NEW',
		clientId: 1,
		clientName: 'Client',
		customFields: {}
	});
	mockedGetContext.mockResolvedValue({
		workItem: { id: 99, type: 'PROJECT', clientId: 1 },
		ancestors: [{ id: 42 }]
	} as never);
	const response = await result(
		await POST({
			request: request(`Bearer ${token}`, 'update_work_item', { workItemId: 42, parentId: 99 })
		} as never)
	);
	expect(response.result.isError).toBe(true);
	expect(mockedUpdateItem).not.toHaveBeenCalled();
});

it('moves a top-level work item to another client', async () => {
	mockedWorkItemExists.mockResolvedValue(true);
	mockedGetItem.mockResolvedValue({
		id: 42,
		name: 'Project',
		type: 'PROJECT',
		status: 'NEW',
		clientId: 1,
		clientName: 'Old client',
		customFields: {}
	});
	mockedGetClientName.mockResolvedValue('New client');
	const response = await result(
		await POST({
			request: request(`Bearer ${token}`, 'update_work_item', { workItemId: 42, clientId: 2 })
		} as never)
	);
	expect(response.result.isError).toBeFalsy();
	expect(mockedUpdateItem).toHaveBeenCalledWith(
		expect.objectContaining({
			name: 'Project',
			clientId: 2,
			clientName: 'New client'
		})
	);
});

it('rejects missing and invalid tokens before reading work data', async () => {
	expect((await POST({ request: request() } as never)).status).toBe(401);
	expect((await POST({ request: request('Bearer wrong') } as never)).status).toBe(401);
	expect(mockedGetContext).not.toHaveBeenCalled();
});

it('serves a work item context through MCP with a valid token', async () => {
	mockedGetContext.mockResolvedValue({
		workItem: { id: 42, name: 'Task' },
		ancestors: []
	} as never);
	const response = await POST({ request: request(`Bearer ${token}`) } as never);
	expect(response.status).toBe(200);
	expect((await result(response)).result.content[0].text).toContain('"name":"Task"');
	expect(mockedGetContext).toHaveBeenCalledWith(42);
});

it('adds a Markdown note through MCP and returns its document ID', async () => {
	mockedWorkItemExists.mockResolvedValue(true);
	mockedGenerateSummary.mockResolvedValue('Short summary');
	mockedAddDocument.mockResolvedValue(123);

	const response = await POST({
		request: request(`Bearer ${token}`, 'add_work_item_note', {
			workItemId: 42,
			name: 'Implementation note',
			content: '## Detail\nCompleted the first step.'
		})
	} as never);
	expect(response.status).toBe(200);
	expect(mockedWorkItemExists).toHaveBeenCalledWith(42);
	expect(mockedGenerateSummary).toHaveBeenCalledWith('## Detail\nCompleted the first step.');
	expect(mockedAddDocument).toHaveBeenCalledWith({
		workItemId: 42,
		name: 'Implementation note',
		type: 'text/markdown',
		content: '## Detail\nCompleted the first step.',
		summary: 'Short summary'
	});
	expect(JSON.parse((await result(response)).result.content[0].text)).toMatchObject({
		workItemId: 42,
		documentId: 123
	});
});

it('does not create a note when the work item is missing or content is blank', async () => {
	mockedWorkItemExists.mockResolvedValue(false);
	const missing = await result(
		await POST({
			request: request(`Bearer ${token}`, 'add_work_item_note', {
				workItemId: 999,
				name: 'Note',
				content: 'Text'
			})
		} as never)
	);
	expect(missing.result.isError).toBe(true);

	const blank = await result(
		await POST({
			request: request(`Bearer ${token}`, 'add_work_item_note', {
				workItemId: 42,
				name: 'Note',
				content: '  '
			})
		} as never)
	);
	expect(blank.error ?? blank.result?.isError).toBeTruthy();
	expect(mockedGenerateSummary).not.toHaveBeenCalled();
	expect(mockedAddDocument).not.toHaveBeenCalled();
});

it('does not create a note without the bearer token', async () => {
	const response = await POST({
		request: request(undefined, 'add_work_item_note', {
			workItemId: 42,
			name: 'Note',
			content: 'Text'
		})
	} as never);
	expect(response.status).toBe(401);
	expect(mockedAddDocument).not.toHaveBeenCalled();
});
