import type { WorkItemDocument, WorkItem, WorkItemChangeEvent } from '../../../types';
import { query } from '$lib/server/db';

export async function addWorkItem(item: WorkItem): Promise<number> {
	const res = await query<{ id: number }>(
		'INSERT INTO work_items (name, work_item_type, status, description, client_id, parent_id, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
		[
			item.name,
			item.type,
			item.status,
			item.description ?? null,
			item.clientId,
			item.parentId ?? null,
			item.customFields ?? {}
		]
	);
	return res.rows[0].id;
}

export async function addWorkItemDocument(item: WorkItemDocument): Promise<number> {
	const res = await query<{ id: number }>(
		'INSERT INTO work_item_documents (work_item_id, name, content_type, content, summary) VALUES ($1, $2, $3, $4, $5) RETURNING id',
		[item.workItemId, item.name, item.type, item.content, item.summary ?? '']
	);
	const newId = res.rows[0].id;

	await query(
		'INSERT INTO work_item_changes (work_item_id, summary_of_changes) VALUES ($1, $2)',
		[item.workItemId, `Document added: ${item.name}`]
	);

	return newId;
}

export async function updateWorkItem(item: WorkItem) {
	const oldItem = await getWorkItemById(item.id!);
	const changes = [];

	if (item.status !== oldItem.status) {
		changes.push(`Status: ${oldItem.status} → ${item.status}`);
	}

	const oldFields = oldItem.customFields || {};
	const fields = item.customFields || {};

	for (const key in fields) {
		if (fields[key] !== oldFields[key]) {
			changes.push(`${key}: ${oldFields[key] ?? 'None'} → ${fields[key]}`);
		}
	}

	await query(
		'UPDATE work_items SET name = $1, work_item_type = $2, status = $3, description = $4, parent_id = $5, custom_fields = $6, updated_at = NOW() WHERE id = $7',
		[
			item.name,
			item.type,
			item.status,
			item.description || null,
			item.parentId ?? null,
			item.customFields || {},
			item.id
		]
	);

	if (changes.length > 0) {
		await query(
			'INSERT INTO work_item_changes (work_item_id, summary_of_changes) VALUES ($1, $2)',
			[item.id, changes.join(' | ')]
		);
	}
}

export async function updateWorkItemDocument(item: WorkItemDocument) {
	await query(
		'UPDATE work_item_documents SET name = $1, content_type = $2, content = $3, summary = $4, updated_at = NOW() WHERE id = $5 AND work_item_id = $6',
		[item.name, item.type, item.content, item.summary ?? '', item.id, item.workItemId]
	);

	await query(
		'INSERT INTO work_item_changes (work_item_id, summary_of_changes) VALUES ($1, $2)',
		[item.workItemId, `Document updated: ${item.name}`]
	);
}

export async function getTopLevelWorkItemsForClient(
	clientId: number,
	statuses: string[] | null
): Promise<WorkItem[]> {
	let sql = 'SELECT id, name, work_item_type, status, client_id, parent_id FROM work_items WHERE client_id = $1 AND parent_id IS NULL';
	const params: (number | string[])[] = [clientId];

	if (statuses && statuses.length > 0) {
		sql += ' AND status = ANY($2)';
		params.push(statuses);
	}

	sql += ' ORDER BY name';

	const res = await query<{
		id: number;
		name: string;
		work_item_type: string;
		status: string;
		client_id: number;
		parent_id: number | null;
	}>(sql, params);

	return res.rows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.work_item_type,
		status: row.status,
		clientId: row.client_id,
		clientName: '', // This might need to be joined if needed, but original code didn't join it from DynamoDB
		parentId: row.parent_id ?? undefined,
		customFields: {}
	}));
}

export async function getChildWorkItems(
	parent: WorkItem,
	statuses: string[] | null
): Promise<WorkItem[]> {
	const sql = `
		SELECT id, name, work_item_type, status, client_id, parent_id
		FROM work_items
		WHERE parent_id = $1 AND ($2::text[] IS NULL OR status = ANY($2))
		ORDER BY NAME;`;
	const params= [parent.id, statuses?.length ? statuses : null];

	const res = await query<{
		id: number;
		name: string;
		work_item_type: string;
		status: string;
		client_id: number;
		parent_id: number | null;
	}>(sql, params);

	return res.rows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.work_item_type,
		status: row.status,
		clientId: row.client_id,
		clientName: parent.clientName,
		parentId: row.parent_id ?? undefined,
		customFields: {}
	}));
}

export async function getWorkItemById(id: number): Promise<WorkItem> {
	const res = await query<{
		id: number;
		name: string;
		work_item_type: string;
		status: string;
		client_id: number;
		parent_id: number | null;
		description: string | null;
		custom_fields: Record<string, unknown>;
		client_name: string;
	}>(
		`SELECT w.*, c.name as client_name 
         FROM work_items w 
         JOIN clients c ON w.client_id = c.id 
         WHERE w.id = $1`,
		[id]
	);

	if (res.rowCount === 0) {
		throw new Error('Work item not found');
	}
	const row = res.rows[0];
	const workItem: WorkItem = {
		id: row.id,
		name: row.name,
		type: row.work_item_type,
		status: row.status,
		parentId: row.parent_id ?? undefined,
		clientId: row.client_id,
		clientName: row.client_name,
		description: row.description ?? undefined,
		customFields: row.custom_fields || {}
	};

	workItem.documents = await getWorkItemDocuments(id);
	return workItem;
}

export async function getWorkItemDocuments(workItemId: number): Promise<WorkItemDocument[]> {
	const res = await query<{
		id: number;
		name: string;
		content_type: string;
		content: string;
		summary: string | null;
	}>(
		'SELECT id, name, content_type, content, summary FROM work_item_documents WHERE work_item_id = $1 ORDER BY id',
		[workItemId]
	);

	return res.rows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.content_type,
		content: row.content,
		workItemId: workItemId,
		summary: row.summary ?? undefined
	}));
}

export async function getWorkItemDocumentById(
	workItemId: number,
	documentId: number
): Promise<WorkItemDocument> {
	const res = await query<{
		id: number;
		name: string;
		content_type: string;
		content: string;
		summary: string | null;
	}>(
		'SELECT id, name, content_type, content, summary FROM work_item_documents WHERE work_item_id = $1 AND id = $2',
		[workItemId, documentId]
	);

	if (res.rowCount === 0) {
		throw new Error('Work item document not found');
	}
	const row = res.rows[0];
	return {
		id: row.id,
		name: row.name,
		type: row.content_type,
		content: row.content,
		workItemId,
		summary: row.summary ?? undefined
	};
}

export async function getEventsForRange(
	clientId: number,
	startDate: Date,
	endDate: Date
): Promise<WorkItemChangeEvent[]> {
	const res = await query<{
		id: number;
		work_item_id: number;
		created_at: Date;
		summary_of_changes: string;
	}>(
		`SELECT wic.id, wic.work_item_id, wic.created_at, wic.summary_of_changes 
         FROM work_item_changes wic
         JOIN work_items wi ON wic.work_item_id = wi.id
         WHERE wi.client_id = $1 AND wic.created_at BETWEEN $2 AND $3
         ORDER BY wic.created_at DESC`,
		[clientId, startDate, endDate]
	);

	return res.rows.map((row) => ({
		id: row.id,
		workItemId: row.work_item_id,
		createdAt: row.created_at,
		summaryOfChanges: row.summary_of_changes
	}));
}
