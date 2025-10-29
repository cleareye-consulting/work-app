import type { ProductElement, ProductElementDocument } from '../../../types';
import { getDB } from '$lib/server/db';

export async function getProductElements(parentId: number | null, clientId: number | null): Promise<ProductElement[]> {
	const pool = getDB()
	const sql = `
		select pe.id, pe.name, pe.client_id, c.name as client_name 
		from product_elements as pe inner join clients as c on pe.client_id = c.id 
		where ($1::int is null and pe.parent_product_element_id is null or $1::int is not null and pe.parent_product_element_id = $1::int)
			and ($2::int is null or pe.client_id = $2::int)
			order by pe.id;`
	const result = await pool.query(sql, [parentId, clientId]);
	return result.rows.map(row => {
		return {
			id: row.id,
			clientId: row.client_id,
			clientName: row.client_name,
			name: row.name
		}
	})

}

export async function getProductElementById(id: number): Promise<ProductElement | null> {
	const pool = getDB()
	const sql = `
		select pe.id, pe.name, pe.client_id, c.name as client_name
		from product_elements as pe inner join clients as c on pe.client_id = c.id
		where pe.id = $1;`
	const result = await pool.query(sql, [id])
	if (result.rows.length === 0) {
		return null
	}
	const row = result.rows[0]
	return {
		id: row.id,
		name: row.name,
		clientId: row.client_id,
		clientName: row.client_name
	}
}

export async function addProductElement(item: ProductElement): Promise<number> {
	const pool= getDB()
	const sql = `insert into product_elements (name, client_id, parent_product_element_id) 
							 values ($1, $2, $3::int)
							 returning id;`
	const result = await pool.query(sql, [item.name, item.clientId, item.parentProductElementId])
	return result.rows[0].id
}

export async function getProductElementDocuments(productElementId: number): Promise<ProductElementDocument[]>{
	const pool = getDB()
	const sql = "select id, product_element_id, name, type, content from product_element_documents where product_element_id = $1 order by id";
	const result = await pool.query(sql, [productElementId]);
	return result.rows.map(row => {
		return {
			id: row.id,
			productElementId: row.product_element_id,
			name: row.name,
			type: row.type,
			content: row.content
		}
	});
}

export async function getProductElementDocumentById(id: string): Promise<ProductElementDocument> {
	const pool = getDB()
	const sql = "select id, product_element_id, name, type, content from product_element_documents where id = $1;"
	const result = await pool.query(sql, [id]);
	const row = result.rows[0];
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		productElementId: row.product_element_id,
		content: row.content
	}
}

export async function addProductElementDocument(item: ProductElementDocument): Promise<number> {
	const pool = getDB()
	const sql = "insert into product_element_documents (product_element_id, name, type, content) values ($1, $2, $3, $4) returning id;"
	const result = await pool.query(sql, [item.productElementId, item.name, item.type, item.content]);
	return result.rows[0].id
}

export async function updateProductElementDocument(item: ProductElementDocument) {
	const pool = getDB()
	const sql = "update product_element_documents set name=$2, type=$3, content=$4 where id=$1;"
	await pool.query(sql, [item.id, item.name, item.type, item.content]);
}
