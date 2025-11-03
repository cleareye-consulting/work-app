import type { Client, ClientDocument } from '../../../types';
import {
	dynamoDBDocumentClient,
	getNextSequenceNumber,
	getTableName
} from '$lib/server/db';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export async function addClient(item: Client): Promise<number> {
	const newId = await getNextSequenceNumber("CLIENT")
	await dynamoDBDocumentClient.send(new PutCommand({
			TableName: getTableName(),
			Item:
				{
					PK: `CLIENT#${newId}`,
					SK: 'METADATA',
					entityType: 'CLIENT',
					entityId: newId,
					name: item.name,
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				}
	}));
	return newId;
}

export async function addClientDocument(item: ClientDocument): Promise<number> {
	const newId = await getNextSequenceNumber("DOC-CLIENT")
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: getTableName(),
		Item: {
			PK: `CLIENT#${item.clientId}`,
			SK: `DOC#${newId}`,
			name: item.name,
			type: item.type,
			content: item.content,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}
	}))
	return newId
}

export async function updateClient(item: Client) {
	await dynamoDBDocumentClient.send(new UpdateCommand({
		TableName: getTableName(),
		Key: {
			PK: `CLIENT#${item.id}`,
			SK: 'METADATA'
		},
		UpdateExpression: 'set #name = :name, #isActive = :isActive, #updatedAt = :updatedAt',
		ExpressionAttributeNames: {
			'#name': 'name',
			'#isActive': 'isActive',
			'#updatedAt': 'updatedAt',
		},
		ExpressionAttributeValues: {
			':name': item.name,
			':isActive': item.isActive,
			':updatedAt': new Date().toISOString()
		}
	}))
}

export async function updateClientDocument(item: ClientDocument) {
	await dynamoDBDocumentClient.send(new UpdateCommand({
		TableName: getTableName(),
		Key: {
			PK: `CLIENT#${item.clientId}`,
			SK: `DOC#${item.id}`
		},
		UpdateExpression: 'set #name = :name, #type = :type, #content = :content, #updatedAt = :updatedAt',
		ExpressionAttributeNames: {
			'#name': 'name',
			'#type': 'type',
			'#content': 'content',
			'#updatedAt': 'updatedAt',
		},
		ExpressionAttributeValues: {
			':name': item.name,
			':type': item.type,
			':content': item.content,
			':updatedAt': new Date().toISOString()
		}
	}))
}

export async function getClientById(id: number): Promise<Client> {
	const getResult = await dynamoDBDocumentClient.send(new GetCommand({
		TableName: getTableName(),
		Key: {
			PK: `CLIENT#${id}`,
			SK: 'METADATA'
		},
		ProjectionExpression: '#name, isActive, entityId',
		ExpressionAttributeNames: {'#name': 'name',}
	}))
	if (!getResult.Item) {
		throw new Error('Client not found')
	}
	const client: Client = {
		id: getResult.Item.entityId,
		name: getResult.Item.name,
		isActive: getResult.Item.isActive
	}
	client.documents = await getClientDocuments(id)
	return client
}

export async function getClients(): Promise<Client[]> {
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		IndexName: 'entityType-index',
		KeyConditionExpression: 'entityType = :type',
		ExpressionAttributeValues: {
			':type': 'CLIENT'
		},
		ScanIndexForward: true,
		ProjectionExpression: 'SK, entityId, #name, isActive',
		ExpressionAttributeNames: {
			'#name': 'name',
		}
	}));

	return (queryResult.Items || [])
		.map(item => ({
			id: item.entityId,
			name: item.name,
			isActive: item.isActive,
		}));
}


export async function getClientDocuments(clientId: number): Promise<ClientDocument[]>{
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		KeyConditionExpression: 'PK = :parentKey AND begins_with(SK, :docPrefix)',
		ExpressionAttributeNames: {
			'#name': 'name',
			'#type': 'type',
			'#content': 'content',
		},
		ExpressionAttributeValues: {
			":parentKey": `CLIENT#${clientId}`,
			":docPrefix": "DOC#",
		},
		ProjectionExpression: 'PK, SK, #name, #type, #content',
		ScanIndexForward: true
	}))
	return (queryResult.Items ?? []).map(item => {
		return {
			id: item.SK.split('#')[1],
			name: item.name,
			type: item.type,
			content: item.content,
			clientId: clientId
		}
	})
}

export async function getClientDocumentById(clientId: number, documentId: number): Promise<ClientDocument> {
	const getResult = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: getTableName(),
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
		throw new Error('Client document not found');
	}
	return {
		id: documentId,
		name: getResult.Item.name,
		type: getResult.Item.type,
		content: getResult.Item.content,
		clientId: clientId
	};
}
