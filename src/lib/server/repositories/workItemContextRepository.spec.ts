import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ query: vi.fn() }));

import { query } from '$lib/server/db';
import { getWorkItemContext } from './workItemContextRepository';

const mockedQuery = vi.mocked(query);

beforeEach(() => mockedQuery.mockReset());

it('returns ancestors in order and nests descendants with their related records', async () => {
	mockedQuery
		.mockResolvedValueOnce({
			rows: [
				{
					id: 1,
					name: 'Project',
					work_item_type: 'PROJECT',
					status: 'IN_PROGRESS',
					description: 'Project detail',
					client_id: 7,
					client_name: 'Client',
					parent_id: null,
					custom_fields: {}
				},
				{
					id: 2,
					name: 'Story',
					work_item_type: 'STORY',
					status: 'IN_PROGRESS',
					description: 'Story detail',
					client_id: 7,
					client_name: 'Client',
					parent_id: 1,
					custom_fields: {}
				},
				{
					id: 3,
					name: 'Task',
					work_item_type: 'TASK',
					status: 'NEW',
					description: 'Task detail',
					client_id: 7,
					client_name: 'Client',
					parent_id: 2,
					custom_fields: {}
				}
			]
		} as never)
		.mockResolvedValueOnce({
			rows: [
				{
					id: 10,
					work_item_id: 3,
					name: 'Note',
					content_type: 'text/markdown',
					content: 'Details',
					summary: 'Summary'
				}
			]
		} as never)
		.mockResolvedValueOnce({
			rows: [
				{
					id: 11,
					work_item_id: 3,
					created_at: new Date('2026-01-01'),
					summary_of_changes: 'Status changed'
				}
			]
		} as never)
		.mockResolvedValueOnce({
			rows: [
				{
					id: 12,
					work_item_id: 3,
					start_time: new Date('2026-01-01T10:00:00Z'),
					end_time: new Date('2026-01-01T11:00:00Z')
				}
			]
		} as never);

	const context = await getWorkItemContext(2);
	expect(context?.ancestors.map((item) => item.id)).toEqual([1]);
	expect(context?.workItem.children.map((item) => item.id)).toEqual([3]);
	expect(context?.workItem.children[0].documents[0].content).toBe('Details');
	expect(context?.workItem.children[0].changes[0].summaryOfChanges).toBe('Status changed');
	expect(context?.workItem.children[0].timeEntries[0].endTime).toBe('2026-01-01T11:00:00.000Z');
	expect(context?.ancestors[0].children).toEqual([]);
});

it('returns null for an unknown work item without loading related records', async () => {
	mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
	expect(await getWorkItemContext(999)).toBeNull();
	expect(mockedQuery).toHaveBeenCalledTimes(1);
});
