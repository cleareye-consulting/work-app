import type { Client } from '../../../types';
import { getDB } from '$lib/server/db';

export async function getClients(): Promise<Client[]> {
	const pool = getDB()
	const sql = "select id, name, is_active from clients order by id;"
	const result = await pool.query(sql)
	return result.rows.map(row => {
		return {
			id: row.id,
			name: row.name,
			isActive: row.is_active,
		}
	})

}

export async function addClient(item: Client): Promise<number> {
	const pool = getDB()
	const sql = "insert into clients (name, is_active) values ($1, true) returning id;"
	const result = await pool.query(sql, [item.name]);
	return result.rows[0][0]
}

export async function getClientById(id: string): Promise<Client> {
	const pool = getDB()
	const sql = "select id, name, is_active from clients where id = $1;"
	const result = await pool.query(sql, [id]);
	return {
		id: result.rows[0].id,
		name: result.rows[0].name,
		isActive: result.rows[0].is_active
	}
}

export async function updateClient(item: Client) {
	const pool = getDB()
	const sql = "update clients set name=$2, is_active=$3 where id=$1;"
	await pool.query(sql, [item.id, item.name, item.isActive]);
}