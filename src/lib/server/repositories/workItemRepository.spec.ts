import { expect, it, vi } from 'vitest';

const connection = {
	query: vi.fn(),
	release: vi.fn()
};
vi.mock('$lib/server/db', () => ({
	query: vi.fn(),
	pool: { connect: vi.fn(async () => connection) }
}));

import { pool, query } from '$lib/server/db';
import { addWorkItemDocument, updateWorkItem } from './workItemRepository';

it('rolls back the document when recording its change event fails', async () => {
	connection.query.mockReset();
	connection.release.mockReset();
	connection.query
		.mockResolvedValueOnce(undefined)
		.mockResolvedValueOnce({ rows: [{ id: 123 }] })
		.mockRejectedValueOnce(new Error('change event failed'))
		.mockResolvedValueOnce(undefined);

	await expect(
		addWorkItemDocument({
			workItemId: 42,
			name: 'Note',
			type: 'text/markdown',
			content: 'Content'
		})
	).rejects.toThrow('change event failed');
	expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
	expect(connection.release).toHaveBeenCalledOnce();
});

it('records type, parent, and cleared custom field changes', async () => {
	const mockedQuery = vi.mocked(query);
	mockedQuery.mockReset();
	mockedQuery
		.mockResolvedValueOnce({
			rowCount: 1,
			rows: [
				{
					id: 42,
					name: 'Feature',
					work_item_type: 'FEATURE',
					status: 'NEW',
					client_id: 1,
					client_name: 'Client',
					parent_id: 7,
					description: 'Description',
					custom_fields: { roadmap: 'Old plan' }
				}
			]
		} as never)
		.mockResolvedValueOnce({ rows: [] } as never)
		.mockResolvedValueOnce({ rows: [] } as never)
		.mockResolvedValueOnce({ rows: [] } as never);

	await updateWorkItem({
		id: 42,
		name: 'Feature',
		type: 'PROJECT',
		status: 'NEW',
		description: 'Description',
		clientId: 1,
		clientName: 'Client',
		parentId: undefined,
		customFields: {}
	});
	expect(mockedQuery).toHaveBeenLastCalledWith(
		'INSERT INTO work_item_changes (work_item_id, summary_of_changes) VALUES ($1, $2)',
		[42, 'Type: FEATURE → PROJECT | Parent: 7 → None | roadmap: Old plan → None']
	);
});

it('moves descendants and time entries with a work item when its client changes', async () => {
	const mockedQuery = vi.mocked(query);
	mockedQuery.mockReset();
	mockedQuery
		.mockResolvedValueOnce({
			rowCount: 1,
			rows: [
				{
					id: 42,
					name: 'Project',
					work_item_type: 'PROJECT',
					status: 'NEW',
					client_id: 1,
					client_name: 'Old client',
					parent_id: null,
					description: null,
					custom_fields: {}
				}
			]
		} as never)
		.mockResolvedValueOnce({ rows: [] } as never);
	connection.query.mockReset().mockResolvedValue({ rows: [] });
	connection.release.mockReset();
	vi.mocked(pool.connect).mockClear();

	await updateWorkItem({
		id: 42,
		name: 'Project',
		type: 'PROJECT',
		status: 'NEW',
		clientId: 2,
		clientName: 'New client',
		customFields: {}
	});
	expect(pool.connect).toHaveBeenCalledOnce();
	expect(connection.query).toHaveBeenNthCalledWith(1, 'BEGIN');
	expect(connection.query.mock.calls[2][0]).toContain('UPDATE work_items SET client_id = $2');
	expect(connection.query.mock.calls[3][0]).toContain('UPDATE time_entries SET client_id = $2');
	expect(connection.query).toHaveBeenCalledWith(
		'INSERT INTO work_item_changes (work_item_id, summary_of_changes) VALUES ($1, $2)',
		[42, 'Client: 1 → 2']
	);
	expect(connection.query).toHaveBeenLastCalledWith('COMMIT');
	expect(connection.release).toHaveBeenCalledOnce();
});

it('rolls back a client move if a descendant update fails', async () => {
	vi.mocked(query)
		.mockReset()
		.mockResolvedValueOnce({
			rowCount: 1,
			rows: [
				{
					id: 42,
					name: 'Project',
					work_item_type: 'PROJECT',
					status: 'NEW',
					client_id: 1,
					client_name: 'Old client',
					parent_id: null,
					description: null,
					custom_fields: {}
				}
			]
		} as never)
		.mockResolvedValueOnce({ rows: [] } as never);
	connection.query
		.mockReset()
		.mockResolvedValueOnce(undefined)
		.mockResolvedValueOnce(undefined)
		.mockRejectedValueOnce(new Error('descendant update failed'))
		.mockResolvedValueOnce(undefined);
	connection.release.mockReset();

	await expect(
		updateWorkItem({
			id: 42,
			name: 'Project',
			type: 'PROJECT',
			status: 'NEW',
			clientId: 2,
			clientName: 'New client',
			customFields: {}
		})
	).rejects.toThrow('descendant update failed');
	expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
	expect(connection.release).toHaveBeenCalledOnce();
});
