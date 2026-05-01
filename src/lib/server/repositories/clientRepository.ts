import type { Client, ClientDocument, ClientSummary } from '../../../types';
import { query } from '$lib/server/db';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedClientList: Client[] = [];
let cacheExpirationTime = 0;

function invalidateCache() {
	cachedClientList = [];
	cacheExpirationTime = 0;
}

function getClientListFromCache(): Client[] | null {
	if (cacheExpirationTime < Date.now()) {
		return null;
	}
	return cachedClientList;
}

function cacheClientList(items: Client[]) {
	cachedClientList = items;
	cacheExpirationTime = Date.now() + CACHE_TTL_MS;
}

export async function getClientName(id: number): Promise<string> {
	const cachedClientList = getClientListFromCache();
	const cachedClient = cachedClientList?.find((c) => c.id === id);
	if (cachedClient) {
		return cachedClient.name;
	}
	return (await getClientById(id)).name;
}

export async function addClient(item: Client): Promise<number> {
	invalidateCache();
	const res = await query<{ id: number }>(
		'INSERT INTO clients (name, billing_start_day_of_month, is_active) VALUES ($1, $2, $3) RETURNING id',
		[item.name, item.billingStartDayOfMonth, item.isActive]
	);
	return res.rows[0].id;
}

export async function addClientDocument(item: ClientDocument): Promise<number> {
	invalidateCache();
	const res = await query<{ id: number }>(
		'INSERT INTO client_documents (client_id, name, content_type, content, summary) VALUES ($1, $2, $3, $4, $5) RETURNING id',
		[item.clientId, item.name, item.type, item.content, '']
	);
	return res.rows[0].id;
}

export async function addClientSummary(clientId: number | string, content: string): Promise<number> {
	const res = await query<{ id: number }>(
		'INSERT INTO client_summaries (client_id, content) VALUES ($1, $2) RETURNING id',
		[clientId, content]
	);
	return res.rows[0].id;
}

export async function updateClient(item: Client) {
	invalidateCache();
	await query(
		'UPDATE clients SET name = $1, billing_start_day_of_month = $2, is_active = $3, updated_at = NOW() WHERE id = $4',
		[item.name, item.billingStartDayOfMonth, item.isActive, item.id]
	);
}

export async function updateClientDocument(item: ClientDocument) {
	invalidateCache();
	await query(
		'UPDATE client_documents SET name = $1, content_type = $2, content = $3, updated_at = NOW() WHERE id = $4 AND client_id = $5',
		[item.name, item.type, item.content, item.id, item.clientId]
	);
}

export async function getClientById(id: number): Promise<Client> {
	const res = await query<{ id: number; name: string; is_active: boolean; billing_start_day_of_month: number }>(
		'SELECT id, name, is_active, billing_start_day_of_month FROM clients WHERE id = $1',
		[id]
	);
	if (res.rowCount === 0) {
		throw new Error('Client not found');
	}
	const row = res.rows[0];
	const client: Client = {
		id: row.id,
		name: row.name,
		isActive: row.is_active,
		billingStartDayOfMonth: row.billing_start_day_of_month
	};
	client.documents = await getClientDocuments(id);
	client.summaries = await getClientSummaries(id);
	return client;
}

export async function getClientSummaries(clientId: number): Promise<ClientSummary[]> {
	const res = await query<{ id: number; client_id: number; content: string; created_at: Date }>(
		'SELECT id, client_id, content, created_at FROM client_summaries WHERE client_id = $1 ORDER BY created_at DESC',
		[clientId]
	);
	return res.rows.map((row) => ({
		id: row.id,
		clientId: row.client_id,
		content: row.content,
		createdAt: row.created_at
	}));
}

export async function getLatestClientSummary(clientId: number): Promise<ClientSummary | null> {
	const res = await query<{ id: number; client_id: number; content: string; created_at: Date }>(
		'SELECT id, client_id, content, created_at FROM client_summaries WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1',
		[clientId]
	);
	return res.rows.length > 0 ? ({
		id: res.rows[0].id,
		clientId: res.rows[0].client_id,
		content: res.rows[0].content,
		createdAt: res.rows[0].created_at
	}) : null;
}

export async function getClients(): Promise<Client[]> {
	const cachedValues = getClientListFromCache();
	if (cachedValues) {
		return cachedValues as Client[];
	}
	const res = await query<{ id: number; name: string; is_active: boolean; billing_start_day_of_month: number }>(
		'SELECT id, name, is_active, billing_start_day_of_month FROM clients WHERE is_active = true ORDER BY name'
	);
	const results = res.rows.map((row) => ({
		id: row.id,
		name: row.name,
		isActive: row.is_active,
		billingStartDayOfMonth: row.billing_start_day_of_month
	}));
	cacheClientList(results);
	return results;
}

export async function getClientDocuments(clientId: number): Promise<ClientDocument[]> {
	const res = await query<{ id: number; name: string; content_type: string; content: string }>(
		'SELECT id, name, content_type, content FROM client_documents WHERE client_id = $1 ORDER BY id',
		[clientId]
	);
	return res.rows.map((row) => ({
		id: row.id,
		name: row.name,
		type: row.content_type,
		content: row.content,
		clientId: clientId
	}));
}

export async function updateClientSummary(summary: ClientSummary) {
	await query(
		'UPDATE client_summaries SET content = $1, updated_at = NOW() WHERE id = $2',
		[summary.content, summary.id]
	);
}

export async function getClientSummaryById(
	id: number
): Promise<ClientSummary> {
	const res = await query<{ id: number; client_id: number; content: string; created_at: Date }>(
		'SELECT id, client_id, content, created_at FROM client_summaries WHERE id = $1',
		[id]
	);
	if (res.rowCount === 0) {
		throw new Error('Client summary not found');
	}
	const row = res.rows[0];
	return {
		id: row.id,
		clientId: row.client_id,
		content: row.content,
		createdAt: row.created_at
	};
}

export async function getClientDocumentById(
	clientId: number,
	documentId: number
): Promise<ClientDocument> {
	const res = await query<{ id: number; name: string; content_type: string; content: string }>(
		'SELECT id, name, content_type, content FROM client_documents WHERE client_id = $1 AND id = $2',
		[clientId, documentId]
	);
	if (res.rowCount === 0) {
		throw new Error(`Client ${clientId} document ${documentId} not found`);
	}
	const row = res.rows[0];
	return {
		id: row.id,
		name: row.name,
		type: row.content_type,
		content: row.content,
		clientId: clientId
	};
}
