import type { WorkItemDocument, WorkItem, WorkItemType } from '../../../types';
import { getDB } from '$lib/server/db';

export async function getWorkItems(parentId: number | null, clientId: number | null): Promise<WorkItem[]> {
	const pool = getDB()
	const sql = `
		select wi.id, wi.name, 	wi.work_item_type_id, wit.name as work_item_type_name, 
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
		select wi.id, wi.name, wi.work_item_type_id, wit.name as work_item_type_name, 
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

export async function addWorkItem(item: WorkItem): Promise<number> {
	const pool = getDB()
	const sql = `
		insert into work_items (name, work_item_type_id, client_id, parent_id) 
		values ($1, $2, $3, $4)
		returning id;
	`
	const result = await pool.query(sql, [item.name, item.workItemTypeId, item.clientId, item.parentId])
	return result.rows[0].id
}

export async function getWorkItemTypes(): Promise<WorkItemType[]> {
	if (cachedWorkItemTypes) {
		return cachedWorkItemTypes
	}
	console.warn('Retrieving work item types from the database')
	const pool = getDB()
	const sql = `
		select id, name from work_item_types;
	`
	const result = await pool.query(sql)
	cachedWorkItemTypes = result.rows.map(row => {
		return {
			id: row.id,
			name: row.name
		}
	})
	return cachedWorkItemTypes
}

let cachedWorkItemTypes: WorkItemType[] | null = null

export async function getWorkItemDocuments(workItemId: number): Promise<WorkItemDocument[]>{
	const pool = getDB()
	const sql = "select id, work_item_id, name, type, content from work_item_documents where work_item_id = $1 order by id";
	const result = await pool.query(sql, [workItemId]);
	return result.rows.map(row => {
		return {
			id: row.id,
			workItemId: row.work_item_id,
			name: row.name,
			type: row.type,
			content: row.content
		}
	});
}

export async function getWorkItemDocumentById(id: string): Promise<WorkItemDocument> {
	const pool = getDB()
	const sql = "select id, work_item_id, name, type, content from work_item_documents where id = $1;"
	const result = await pool.query(sql, [id]);
	const row = result.rows[0];
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		workItemId: row.work_item_id,
		content: row.content
	}
}

export async function addWorkItemDocument(item: WorkItemDocument): Promise<number> {
	const pool = getDB()
	const sql = "insert into work_item_documents (work_item_id, name, type, content) values ($1, $2, $3, $4) returning id;"
	const result = await pool.query(sql, [item.workItemId, item.name, item.type, item.content]);
	return result.rows[0].id
}

export async function updateWorkItemDocument(item: WorkItemDocument) {
	const pool = getDB()
	const sql = "update work_item_documents set name=$2, type=$3, content=$4 where id=$1;"
	await pool.query(sql, [item.id, item.name, item.type, item.content]);
}
