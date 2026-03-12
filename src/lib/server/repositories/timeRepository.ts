import { query, pool } from '$lib/server/db';
import type { TimeEntry, TimeTrackingStatus } from '../../../types';

export async function getTimeEntriesByClientAndRange(
	clientId: number,
	startDate: string,
	endDate: string
): Promise<TimeEntry[]> {
	const res = await query<{
		id: number;
		work_item_id: number;
		client_id: number;
		start_time: Date;
		end_time: Date | null;
	}>(
		`SELECT te.id, te.work_item_id, wi.client_id, te.start_time, te.end_time 
         FROM time_entries te
         JOIN work_items wi ON te.work_item_id = wi.id
         WHERE wi.client_id = $1 AND te.start_time BETWEEN $2 AND $3`,
		[clientId, startDate, endDate]
	);

	return res.rows.map((row) => ({
		id: row.id,
		workItemId: row.work_item_id,
		clientId: row.client_id,
		startTime: row.start_time.toISOString(),
		endTime: row.end_time?.toISOString()
	}));
}

export async function getTimeTrackingStatus(): Promise<TimeTrackingStatus> {
	// In Postgres, we look for an entry without an end_time
	const res = await query<{
		id: number;
		work_item_id: number;
		client_id: number;
	}>(
		`SELECT te.id, te.work_item_id, wi.client_id 
         FROM time_entries te
         JOIN work_items wi ON te.work_item_id = wi.id
         WHERE te.end_time IS NULL 
         LIMIT 1`
	);

	if (res.rowCount === 0) {
		return {};
	}

	const row = res.rows[0];
	return {
		activeTimeEntryId: row.id,
		activeWorkItemId: row.work_item_id,
		activeClientId: row.client_id
	};
}

export async function startTracking(workItemId: number, clientId: number): Promise<number> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		// 1. Stop current tracking if exists
		await client.query(
			'UPDATE time_entries SET end_time = NOW(), updated_at = NOW() WHERE end_time IS NULL'
		);

		// 2. Create new tracking record
		const res = await client.query<{ id: number }>(
			'INSERT INTO time_entries (work_item_id, start_time) VALUES ($1, NOW()) RETURNING id',
			[workItemId]
		);

		await client.query('COMMIT');
		return res.rows[0].id;
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}

export async function stopTracking(timeEntryId: number, workItemId: number): Promise<void> {
	await query(
		'UPDATE time_entries SET end_time = NOW(), updated_at = NOW() WHERE id = $1 AND work_item_id = $2',
		[timeEntryId, workItemId]
	);
}

export async function getTimeEntriesByWorkItem(workItemId: number): Promise<TimeEntry[]> {
	const res = await query<{
		id: number;
		work_item_id: number;
		client_id: number;
		start_time: Date;
		end_time: Date | null;
	}>(
		`SELECT te.id, te.work_item_id, wi.client_id, te.start_time, te.end_time 
         FROM time_entries te
         JOIN work_items wi ON te.work_item_id = wi.id
         WHERE te.work_item_id = $1
         ORDER BY te.start_time DESC`,
		[workItemId]
	);

	return res.rows.map((row) => ({
		id: row.id,
		workItemId: row.work_item_id,
		clientId: row.client_id,
		startTime: row.start_time.toISOString(),
		endTime: row.end_time?.toISOString()
	}));
}
