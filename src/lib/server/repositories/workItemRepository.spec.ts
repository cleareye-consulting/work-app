import { expect, it, vi } from 'vitest';

const connection = {
	query: vi.fn(),
	release: vi.fn()
};
vi.mock('$lib/server/db', () => ({
	query: vi.fn(),
	pool: { connect: vi.fn(async () => connection) }
}));

import { addWorkItemDocument } from './workItemRepository';

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
