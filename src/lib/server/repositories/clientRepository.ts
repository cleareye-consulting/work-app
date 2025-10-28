import type { Client, ClientDocument } from '../../../types';
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

export async function getClientById(id: number): Promise<Client> {
	const pool = getDB()
	const sql = "select id, name, is_active from clients where id = $1;"
	const result = await pool.query(sql, [id]);
	const documents = await getClientDocuments(id)
	return {
		id: result.rows[0].id,
		name: result.rows[0].name,
		isActive: result.rows[0].is_active,
		documents
	}
}

async function getClientDocuments(clientId: number): Promise<ClientDocument[]>{
	const pool = getDB()
	const sql = "select id, client_id, name, type, content from client_documents where client_id = $1 order by id";
	const result = await pool.query(sql, [clientId]);
	return result.rows.map(row => {
		return {
			id: row.id,
			clientId: row.client_id,
			name: row.name,
			type: row.type,
			content: row.content
		}
	});
}

export async function updateClient(item: Client) {
	const pool = getDB()
	const sql = "update clients set name=$2, is_active=$3 where id=$1;"
	await pool.query(sql, [item.id, item.name, item.isActive]);
}

export async function addClientDocument(item: ClientDocument): Promise<number> {
	const pool = getDB()
	const sql = "insert into client_documents (client_id, name, type, content) values ($1, $2, $3, $4) returning id;"
	const result = await pool.query(sql, [item.clientId, item.name, item.type, item.content]);
	return result.rows[0].id
}

export async function getClientDocumentById(id: string): Promise<ClientDocument> {
	const pool = getDB()
	const sql = "select id, client_id, name, type, content from client_documents where id = $1;"
	const result = await pool.query(sql, [id]);
	const row = result.rows[0];
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		clientId: row.client_id,
		content: row.content
	}
}

export async function updateClientDocument(item: ClientDocument) {
	const pool = getDB()
	const sql = "update client_documents set name=$2, type=$3, content=$4 where id=$1;"
	await pool.query(sql, [item.id, item.name, item.type, item.content]);
}