import type { ProductElement, ProductElementDocument } from '../../../types';
import { dynamoDBDocumentClient, getNextSequenceNumber, getTableName } from '$lib/server/db';
import {
	BatchGetCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand
} from '@aws-sdk/lib-dynamodb';

export async function getProductElementsForClient(clientId: number, topLevelOnly: boolean): Promise<ProductElement[]> {
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		IndexName: "clientId-index",
		KeyConditionExpression: "clientId = :clientId",
		ExpressionAttributeValues: {
			":clientId": clientId
		},
		ScanIndexForward: true,
		ProjectionExpression: "id, #name, clientId, clientName, parentId, parentName",
		ExpressionAttributeNames: {
			'#name': 'name'
		}
	}))
	const results: ProductElement[] = [];
	for (const item of queryResult.Items || []) {
		if (topLevelOnly && item.parentId !== null) {
			continue;
		}
		results.push({
			id: item.id,
			clientId: item.clientId,
			clientName: item.clientName,
			name: item.name,
		})
	}
	return results;
}

export async function getChildProductElements(parentId: number): Promise<ProductElement[]> {
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		IndexName: "parentId-index",
		KeyConditionExpression: "parentId = :parentId",
		ExpressionAttributeValues: {
			":parentId": parentId
		},
		ScanIndexForward: true,
		ProjectionExpression: "id, #name, clientId, clientName, parentId, parentName",
		ExpressionAttributeNames: {
			'#name': 'name'
		}
	}))
	return (queryResult.Items ?? []).map(item => {
		return {
			id: item.id,
			clientId: item.clientId,
			clientName: item.clientName,
			name: item.name,
			parentId: item.parentId,
			parentName: item.parentName
		}
	})

}

export async function getProductElementById(id: number): Promise<ProductElement> {
	const getResponse = await dynamoDBDocumentClient.send(new GetCommand({
		TableName: getTableName(),
		Key: {
			PK: `PE#${id}`,
			SK: 'METADATA'
		},
		ProjectionExpression: '#name, clientId, clientName, parentId, parentName',
		ExpressionAttributeNames: {
			'#name': 'name',
		}
	}))
	if (!getResponse.Item) {
		throw new Error('Product element not found')
	}
	const item = getResponse.Item;
	const result: ProductElement = {
		id: item.EntityId, // Use EntityId for the primary ID
		name: item.name,
		clientId: item.clientId,
		clientName: item.clientName,
		parentId: item.parentId,
		parentName: item.parentName
	}
	result.documents = await getProductElementDocuments(id)
	return result;
}

export async function addProductElement(item: ProductElement): Promise<number> {
	const newId = await getNextSequenceNumber("PE");
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: getTableName(),
		Item: {
			PK: `PE#${newId}`,
			SK: 'METADATA',
			entityType: 'PE',
			entityId: newId,
			name: item.name,
			clientId: item.clientId,
			clientName: item.clientName,
			parentId: item.parentId ?? null,
			parentName: item.parentName ?? null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		},
	}));
	return newId;
}

export async function getProductElementDocuments(productElementId: number): Promise<ProductElementDocument[]>{
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		KeyConditionExpression: 'PK = :parentKey AND begins_with(SK, :docPrefix)',
		ExpressionAttributeNames: {
			'#name': 'name',
			'#type': 'type',
			'#content': 'content',
		},
		ExpressionAttributeValues: {
			":parentKey": `PE#${productElementId}`,
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
			productElementId
		}
	})
}

export async function getProductElementDocumentById(productElementId: number, documentId: number): Promise<ProductElementDocument> {
	const getResult = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: getTableName(),
			Key: {
				PK: `PE#${productElementId}`,
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
		throw new Error('Product element document not found');
	}
	return {
		id: documentId,
		name: getResult.Item.name,
		type: getResult.Item.type,
		content: getResult.Item.content,
		productElementId: productElementId
	};
}

export async function addProductElementDocument(item: ProductElementDocument): Promise<number> {
	const newId = await getNextSequenceNumber("DOC-PE")
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: getTableName(),
		Item: {
			PK: `PE#${item.productElementId}`,
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

export async function updateProductElementDocument(item: ProductElementDocument) {
	await dynamoDBDocumentClient.send(new UpdateCommand({
		TableName: getTableName(),
		Key: {
			PK: `PE#${item.productElementId}`,
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

export async function getProductElementsForWorkItem(workItemId: number): Promise<ProductElement[]> {
	const workItemPK = `WI#${workItemId}`;

	// 1. Query the WI#<id> partition for all SKs that start with 'PE#'
	const linkQueryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		KeyConditionExpression: 'PK = :pk AND begins_with(SK, :pePrefix)',
		ExpressionAttributeValues: {
			':pk': workItemPK,
			':pePrefix': 'PE#',
		},
		ProjectionExpression: 'SK' // We only need the PE#<id> links
	}));

	const peKeys = (linkQueryResult.Items || []).map(item => {
		const peId = item.SK.split('#')[1];
		// Keys needed for the BatchGet on the PE metadata record
		return {
			PK: `PE#${peId}`,
			SK: 'METADATA'
		};
	});

	if (peKeys.length === 0) {
		return [];
	}

	// 2. BatchGet the metadata for all found Product Elements
	const batchResult = await dynamoDBDocumentClient.send(new BatchGetCommand({
		RequestItems: {
			[getTableName()]: {
				Keys: peKeys,
				ProjectionExpression: 'EntityId, #n, clientId, clientName',
				ExpressionAttributeNames: { '#n': 'name' }
			}
		}
	}));

	return (batchResult.Responses?.[getTableName()] || []).map(item => ({
		id: item.EntityId,
		name: item.name,
		clientId: item.clientId,
		clientName: item.clientName
	})) as ProductElement[];
}

