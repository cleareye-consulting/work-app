import type { WorkItem } from '../../../types';
import { getDB } from '$lib/server/db';

export async function getWorkItems(parentId: number | null, clientId: number | null): Promise<WorkItem[]> {
	const pool = getDB()
	const sql = `
		select wi.id, wi.work_item_type_id, wit.name as work_item_type_name, 
			wi.client_id, c.name as client_name, wi.parent_id, p.name as parent_name
		from work_items as wi 
			inner join work_item_types as wit on wi.work_item_type_id = wit.id 
			inner join clients as c on wi.client_id = c.id 
			left join work_items as p on wi.parent_id = p.id
		where ($1::int is null and wi.parent_id is null or $1::int is not null and wi.parent_id = $1::int)
			and ($2::int is null or wi.client_id = $2::int)
		order by wi.id;
	`
	const result = await pool.query(sql, [parentId, clientId])
	return result.rows.map(row => {
		return {
			id: row.id,
			name: row.name,
			workItemTypeId: row.work_item_type_id,
			workItemTypeName: row.work_item_type_name,
			clientId: row.client_id,
			clientName: row.client_name,
			parentId: row.parent_id,
			parentName: row.parent_name
		}
	})
}

export async function getWorkItemById(id: number): Promise<WorkItem | null> {
	const pool = getDB()
	const sql = `
		select wi.id, wi.work_item_type_id, wit.name as work_item_type_name, 
			wi.client_id, c.name as client_name, wi.parent_id, p.name as parent_name
		from work_items as wi 
			inner join work_item_types as wit on wi.work_item_type_id = wit.id 
			inner join clients as c on wi.client_id = c.id 
			left join work_items as p on wi.parent_id = p.id
		where wi.id = $1;
	`
	const result = await pool.query(sql, [id])
	const row = result.rows[0]
	return {
		id: row.id,
		name: row.name,
		workItemTypeId: row.work_item_type_id,
		workItemTypeName: row.work_item_type_name,
		clientId: row.client_id,
		clientName: row.client_name,
		parentId: row.parent_id,
		parentName: row.parent_name
	}
}