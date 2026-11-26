import { beforeEach, expect, it, vi } from 'vitest';

const token = 'a'.repeat(64);
vi.mock('$env/dynamic/private', () => ({ env: { WORK_APP_MCP_TOKEN: 'a'.repeat(64) } }));
vi.mock('$lib/server/repositories/workItemContextRepository', () => ({
	getWorkItemContext: vi.fn()
}));
vi.mock('$lib/server/repositories/workItemRepository', () => ({
	workItemExists: vi.fn(),
	addWorkItemDocument: vi.fn()
}));
vi.mock('$lib/server/ai', () => ({ generateDocumentSummary: vi.fn() }));

import { getWorkItemContext } from '$lib/server/repositories/workItemContextRepository';
import { addWorkItemDocument, workItemExists } from '$lib/server/repositories/workItemRepository';
import { generateDocumentSummary } from '$lib/server/ai';
import { POST } from './+server';

const mockedGetContext = vi.mocked(getWorkItemContext);
const mockedWorkItemExists = vi.mocked(workItemExists);
const mockedAddDocument = vi.mocked(addWorkItemDocument);
const mockedGenerateSummary = vi.mocked(generateDocumentSummary);

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
	mockedGenerateSummary.mockReset();
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
