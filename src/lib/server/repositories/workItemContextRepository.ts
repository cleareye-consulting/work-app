import { query } from '$lib/server/db';
import type { TimeEntry, WorkItem, WorkItemChangeEvent, WorkItemDocument } from '../../../types';

export interface ContextWorkItem extends WorkItem {
	documents: WorkItemDocument[];
	changes: WorkItemChangeEvent[];
	timeEntries: TimeEntry[];
	children: ContextWorkItem[];
}

export interface WorkItemContext {
	workItem: ContextWorkItem;
	/** From the top-level ancestor down to the immediate parent. */
	ancestors: ContextWorkItem[];
}

/** Loads one work item, its ancestors, its descendants, and their related records. */
export async function getWorkItemContext(id: number): Promise<WorkItemContext | null> {
	const items = await query<{
		id: number;
		name: string;
		work_item_type: string;
		status: string;
		description: string | null;
		client_id: number;
		client_name: string;
		parent_id: number | null;
		custom_fields: Record<string, unknown> | null;
	}>(
		`WITH RECURSIVE ancestors AS (
		   SELECT id, parent_id, ARRAY[id] AS path FROM work_items WHERE id = $1
		   UNION ALL
		   SELECT parent.id, parent.parent_id, ancestors.path || parent.id
		   FROM work_items parent JOIN ancestors ON parent.id = ancestors.parent_id
		   WHERE NOT parent.id = ANY(ancestors.path)
		 ), descendants AS (
		   SELECT id, ARRAY[id] AS path FROM work_items WHERE id = $1
		   UNION ALL
		   SELECT child.id, descendants.path || child.id
		   FROM work_items child JOIN descendants ON child.parent_id = descendants.id
		   WHERE NOT child.id = ANY(descendants.path)
		 )
		 SELECT w.id, w.name, w.work_item_type, w.status, w.description,
		        w.client_id, c.name AS client_name, w.parent_id, w.custom_fields
		 FROM work_items w JOIN clients c ON c.id = w.client_id
		 WHERE w.id IN (SELECT id FROM ancestors UNION SELECT id FROM descendants)
		 ORDER BY w.id`,
		[id]
	);
	if (items.rows.length === 0) return null;

	const byId = new Map<number, ContextWorkItem>();
	for (const row of items.rows) {
		byId.set(row.id, {
			id: row.id,
			name: row.name,
			type: row.work_item_type,
			status: row.status,
			description: row.description ?? undefined,
			clientId: row.client_id,
			clientName: row.client_name,
			parentId: row.parent_id ?? undefined,
			customFields: row.custom_fields ?? {},
			documents: [],
			changes: [],
			timeEntries: [],
			children: []
		});
	}
	const workItem = byId.get(id)!;
	const ids = [...byId.keys()];

	const [documents, changes, timeEntries] = await Promise.all([
		query<{
			id: number;
			work_item_id: number;
			name: string;
			content_type: string;
			content: string;
			summary: string | null;
		}>(
			'SELECT id, work_item_id, name, content_type, content, summary FROM work_item_documents WHERE work_item_id = ANY($1::int[]) ORDER BY id',
			[ids]
		),
		query<{
			id: number;
			work_item_id: number;
			created_at: Date;
			summary_of_changes: string;
		}>(
			'SELECT id, work_item_id, created_at, summary_of_changes FROM work_item_changes WHERE work_item_id = ANY($1::int[]) ORDER BY created_at DESC, id DESC',
			[ids]
		),
		query<{
			id: number;
			work_item_id: number;
			start_time: Date;
			end_time: Date | null;
		}>(
			'SELECT id, work_item_id, start_time, end_time FROM time_entries WHERE work_item_id = ANY($1::int[]) ORDER BY start_time DESC, id DESC',
			[ids]
		)
	]);

	for (const row of documents.rows) {
		byId.get(row.work_item_id)!.documents.push({
			id: row.id,
			workItemId: row.work_item_id,
			name: row.name,
			type: row.content_type,
			content: row.content,
			summary: row.summary ?? undefined
		});
	}
	for (const row of changes.rows) {
		byId.get(row.work_item_id)!.changes.push({
			id: row.id,
			workItemId: row.work_item_id,
			createdAt: row.created_at,
			summaryOfChanges: row.summary_of_changes
		});
	}
	for (const row of timeEntries.rows) {
		const item = byId.get(row.work_item_id)!;
		item.timeEntries.push({
			id: row.id,
			workItemId: row.work_item_id,
			clientId: item.clientId,
			startTime: row.start_time.toISOString(),
			endTime: row.end_time?.toISOString()
		});
	}

	const ancestors: ContextWorkItem[] = [];
	let parentId = workItem.parentId;
	const seenAncestors = new Set([id]);
	while (parentId && byId.has(parentId) && !seenAncestors.has(parentId)) {
		seenAncestors.add(parentId);
		const parent = byId.get(parentId)!;
		ancestors.unshift(parent);
		parentId = parent.parentId;
	}

	const ancestorIds = new Set(ancestors.map((item) => item.id));
	for (const item of byId.values()) {
		if (item.id === id || ancestorIds.has(item.id)) continue;
		byId.get(item.parentId!)?.children.push(item);
	}
	for (const item of byId.values()) item.children.sort((a, b) => a.name.localeCompare(b.name));

	return { workItem, ancestors };
}
