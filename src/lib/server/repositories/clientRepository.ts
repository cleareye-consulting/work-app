import type { Client, ClientDocument, ClientSummary } from '../../../types';
import {
	dynamoDBDocumentClient,
	extractId,
	getNextSequenceNumber,
	TABLE_NAME
} from '$lib/server/db';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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
	const newId = await getNextSequenceNumber('CLIENT');
	await dynamoDBDocumentClient.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: {
				PK: `CLIENT#${newId}`,
				SK: 'METADATA',
				isActiveClient: 'Y', //used for indexing
				name: item.name,
				isActive: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		})
	);
	return newId;
}

export async function addClientDocument(item: ClientDocument): Promise<number> {
	invalidateCache();
	const newId = await getNextSequenceNumber('DOC-CLIENT');
	await dynamoDBDocumentClient.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: {
				PK: `CLIENT#${item.clientId}`,
				SK: `DOC#${newId}`,
				name: item.name,
				type: item.type,
				content: item.content,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		})
	);
	return newId;
}

export async function addClientSummary(clientId: string, content: string) {
	const now = new Date().toISOString();
	const item = {
		PK: `CLIENT#${clientId}`,
		SK: `SUM#${now}`,
		content,
		itemType: 'SUMMARY',
		createdAt: now
	};

	await dynamoDBDocumentClient.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: item
		})
	);
}

export async function updateClient(item: Client) {
	invalidateCache();
	const updateExpression = item.isActive
		? 'set #name = :name, #isActive = :isActive, #updatedAt = :updatedAt'
		: 'set #name = :name, #isActive = :isActive, #updatedAt = :updatedAt REMOVE #isActiveClient';

	await dynamoDBDocumentClient.send(
		new UpdateCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `CLIENT#${item.id}`,
				SK: 'METADATA'
			},
			UpdateExpression: updateExpression,
			ExpressionAttributeNames: {
				'#name': 'name',
				'#isActive': 'isActive',
				'#updatedAt': 'updatedAt'
			},
			ExpressionAttributeValues: {
				':name': item.name,
				':isActive': item.isActive,
				':updatedAt': new Date().toISOString()
			}
		})
	);
}

export async function updateClientDocument(item: ClientDocument) {
	invalidateCache();
	await dynamoDBDocumentClient.send(
		new UpdateCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `CLIENT#${item.clientId}`,
				SK: `DOC#${item.id}`
			},
			UpdateExpression:
				'set #name = :name, #type = :type, #content = :content, #updatedAt = :updatedAt',
			ExpressionAttributeNames: {
				'#name': 'name',
				'#type': 'type',
				'#content': 'content',
				'#updatedAt': 'updatedAt'
			},
			ExpressionAttributeValues: {
				':name': item.name,
				':type': item.type,
				':content': item.content,
				':updatedAt': new Date().toISOString()
			}
		})
	);
}

export async function getClientById(id: number): Promise<Client> {
	const getResult = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `CLIENT#${id}`,
				SK: 'METADATA'
			},
			ProjectionExpression: 'PK, #name, isActive',
			ExpressionAttributeNames: { '#name': 'name' }
		})
	);
	if (!getResult.Item) {
		throw new Error('Client not found');
	}
	const client: Client = {
		id: extractId(getResult.Item.PK, 'CLIENT'),
		name: getResult.Item.name,
		isActive: getResult.Item.isActive
	};
	client.documents = await getClientDocuments(id);
	client.summaries = await getClientSummaries(id);
	return client;
}

export async function getClientSummaries(clientId: number): Promise<ClientSummary[]> {
	const queryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			KeyConditionExpression: 'PK = :parentKey AND begins_with(SK, :summaryPrefix)',
			ExpressionAttributeValues: {
				':parentKey': `CLIENT#${clientId}`,
				':summaryPrefix': 'SUM#'
			},
			ScanIndexForward: false
		})
	);
	return (queryResult.Items ?? []).map((item) => {
		return {
			clientId: clientId,
			content: item.content,
			createdAt: item.createdAt
		};
	});
}

export async function getClients(): Promise<Client[]> {
	const cachedValues = getClientListFromCache();
	if (cachedValues) {
		return cachedValues as Client[];
	}
	const queryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			IndexName: 'isActiveClient-index',
			KeyConditionExpression: 'isActiveClient = :isActiveClient',
			ExpressionAttributeValues: {
				':isActiveClient': 'Y'
			},
			ScanIndexForward: true,
			ProjectionExpression: 'PK, SK, #name, isActive',
			ExpressionAttributeNames: {
				'#name': 'name'
			}
		})
	);
	const results = (queryResult.Items || []).map((item) => ({
		id: extractId(item.PK, 'CLIENT'),
		name: item.name,
		isActive: item.isActive
	}));
	cacheClientList(results);
	return results;
}

export async function getClientDocuments(clientId: number): Promise<ClientDocument[]> {
	const queryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			KeyConditionExpression: 'PK = :parentKey AND begins_with(SK, :docPrefix)',
			ExpressionAttributeNames: {
				'#name': 'name',
				'#type': 'type',
				'#content': 'content'
			},
			ExpressionAttributeValues: {
				':parentKey': `CLIENT#${clientId}`,
				':docPrefix': 'DOC#'
			},
			ProjectionExpression: 'PK, SK, #name, #type, #content',
			ScanIndexForward: true
		})
	);
	return (queryResult.Items ?? []).map((item) => {
		return {
			id: item.SK.split('#')[1],
			name: item.name,
			type: item.type,
			content: item.content,
			clientId: clientId
		};
	});
}

export async function updateClientSummary(summary: ClientSummary) {
	await dynamoDBDocumentClient.send(
		new UpdateCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `CLIENT#${summary.clientId}`,
				SK: `SUM#${summary.createdAt}`
			},
			UpdateExpression: 'set content = :content',
			ExpressionAttributeValues: {
				':content': summary.content
			}
		})
	);
}

export async function getClientSummaryById(
	clientId: number,
	createdAt: string
): Promise<ClientSummary> {
	const getResult = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `CLIENT#${clientId}`,
				SK: `SUM#${createdAt}`
			}
		})
	);
	if (!getResult.Item) {
		throw new Error('Client summary not found');
	}
	return {
		clientId: clientId,
		content: getResult.Item.content,
		createdAt: getResult.Item.createdAt
	};
}

export async function getClientDocumentById(
	clientId: number,
	documentId: number
): Promise<ClientDocument> {
	const getResult = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `CLIENT#${clientId}`,
				SK: `DOC#${documentId}`
			},
			ProjectionExpression: '#name, #type, #content',
			ExpressionAttributeNames: {
				'#name': 'name',
				'#type': 'type',
				'#content': 'content'
			}
		})
	);
	if (!getResult.Item) {
		throw new Error(`Client ${clientId} document ${documentId} not found`);
	}
	return {
		id: documentId,
		name: getResult.Item.name,
		type: getResult.Item.type,
		content: getResult.Item.content,
		clientId: clientId
	};
}
