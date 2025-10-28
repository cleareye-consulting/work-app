import type { ProductElement } from '../../../types';
import { getDB } from '$lib/server/db';

export async function getProductElements(parentId: number | null, clientId: number | null): Promise<ProductElement[]> {
	const pool = getDB()
	const sql = `select pe.id, pe.name, pe.client_id, c.name as client_name 
							 from product_elements as pe inner join clients as c on pe.client_id = c.id 
							 where ($1::int is null and pe.parent_product_element_id is null or $1::int is not null and pe.parent_product_element_id = $1::int)
								   and ($2::int is null or pe.client_id = $2::int);`
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
	const sql = `select pe.id, pe.name, pe.client_id, c.name as client_name
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