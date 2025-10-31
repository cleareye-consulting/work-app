import type { WorkItemDocument, WorkItem  } from '../../../types';
import { getDB } from '$lib/server/db';

export async function getWorkItems(parentId: number | null, clientId: number | null, statuses: string[] | null): Promise<WorkItem[]> {
	const pool = getDB()
	const sql = `
		select wi.id, wi.name, 	wi.type, wi.status,
			wi.client_id, c.name as client_name, wi.parent_id, p.name as parent_name
		from work_items as wi 
			inner join clients as c on wi.client_id = c.id 
			left join work_items as p on wi.parent_id = p.id
		where ($1::int is null and wi.parent_id is null or $1::int is not null and wi.parent_id = $1::int)
			and ($2::int is null or wi.client_id = $2::int)
			and ($3::text[] is null or wi.status = ANY($3))
		order by wi.id;
	`
	const result = await pool.query(sql, [parentId, clientId, statuses])
	return result.rows.map(row => {
		return {
			id: row.id,
			name: row.name,
			status: row.status,
			type: row.type,
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
		select wi.id, wi.name, wi.type, wi.status,
			wi.client_id, c.name as client_name, wi.parent_id, p.name as parent_name
		from work_items as wi 
			inner join clients as c on wi.client_id = c.id 
			left join work_items as p on wi.parent_id = p.id
		where wi.id = $1;
	`
	const result = await pool.query(sql, [id])
	const row = result.rows[0]
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		status: row.status,
		clientId: row.client_id,
		clientName: row.client_name,
		parentId: row.parent_id,
		parentName: row.parent_name
	}
}

export async function addWorkItem(item: WorkItem): Promise<number> {
	const pool = getDB()
	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		const workItemSql = `
			insert into work_items (name, type, status, client_id, parent_id) 
			values ($1, $2, $3, $4, $5)
			returning id;
		`
		const workItemResult = await pool.query(workItemSql, [item.name, item.type, item.status, item.clientId, item.parentId ?? null])
		const workItemId = workItemResult.rows[0].id;
		const productElementSql = `
			insert into work_item_product_elements (work_item_id, product_element_id) 
			values ($1, $2);`
		for (const productElementId of item.productElementIds ?? []) {
			await pool.query(productElementSql, [workItemId, productElementId]);
		}
		await client.query('COMMIT')
		return workItemId;
	}
	catch (e) {
		await client.query('ROLLBACK')
		throw e
	}
	finally {
		client.release()
	}
}

export async function updateWorkItem(item: WorkItem) {
	const pool = getDB()
		const sql = `
			update work_items 
			set name=$2, type=$3, status=$4, client_id=$5, parent_id=$6::int 
			where id=$1;`
		await pool.query(sql, [item.id, item.name, item.type, item.status, item.clientId, item.parentId ?? null])
}

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
	const sql = `
		insert into work_item_documents (work_item_id, name, type, content) 
		values ($1, $2, $3, $4) 
		returning id;`
	const result = await pool.query(sql, [item.workItemId, item.name, item.type, item.content]);
	return result.rows[0].id;
}

export async function updateWorkItemDocument(item: WorkItemDocument) {
	const pool = getDB()
	const sql = "update work_item_documents set name=$2, type=$3, content=$4 where id=$1;"
	await pool.query(sql, [item.id, item.name, item.type, item.content]);
}

export async function getWorkItemsForProductElement(productElementId: number): Promise<WorkItem[]> {
	const pool = getDB()
	const sql = `
		select wi.id, wi.name, wi.type, wi.status,
			wi.client_id, c.name as client_name, wi.parent_id, p.name as parent_name
		from work_items as wi 
			inner join clients as c on wi.client_id = c.id 
			inner join work_item_product_elements as wipe on wi.id = wipe.work_item_id 
			left join work_items as p on wi.parent_id = p.id
		where wipe.product_element_id = $1
	`
	const result = await pool.query(sql, [productElementId])
	return result.rows.map(row => {
		return {
			id: row.id,
			name: row.name,
			type: row.type,
			status: row.status,
			clientId: row.client_id,
			clientName: row.client_name,
			parentId: row.parent_id,
			parentName: row.parent_name
		}
	})
}
