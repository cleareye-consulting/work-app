import type { ProductElement, ProductElementDocument } from '../../../types';
import {
	dynamoDBDocumentClient,
	extractId,
	getNextSequenceNumber,
	TABLE_NAME,
	TOP_LEVEL_PARENT_ID,
	TOP_LEVEL_PARENT_NAME
} from '$lib/server/db';
import {
	BatchGetCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand
} from '@aws-sdk/lib-dynamodb';

function getSearchKey(item: ProductElement, partitionKey: string): string {
	const parentId = item.parentId ?? TOP_LEVEL_PARENT_ID;
	const active = 'active';
	return `${parentId}#${active}#${partitionKey}`;
}

export async function addProductElement(item: ProductElement): Promise<number> {
	const newId = await getNextSequenceNumber('PE');
	const partitionKey = `PE#${newId}`;
	const searchKey = getSearchKey(item, partitionKey);
	await dynamoDBDocumentClient.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: {
				PK: partitionKey,
				SK: 'METADATA',
				searchKey: searchKey,
				name: item.name,
				clientId: item.clientId,
				clientName: item.clientName,
				parentId: item.parentId ?? TOP_LEVEL_PARENT_ID,
				parentName: item.parentName ?? TOP_LEVEL_PARENT_NAME,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		})
	);
	return newId;
}

export async function addProductElementDocument(item: ProductElementDocument): Promise<number> {
	const newId = await getNextSequenceNumber('DOC-PE');
	await dynamoDBDocumentClient.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: {
				PK: `PE#${item.productElementId}`,
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

export async function updateProductElementDocument(item: ProductElementDocument) {
	await dynamoDBDocumentClient.send(
		new UpdateCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `PE#${item.productElementId}`,
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

export async function getProductElementsForClient(clientId: number): Promise<ProductElement[]> {
	const queryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			IndexName: 'clientId-searchKey-index',
			KeyConditionExpression: 'clientId = :clientId AND begins_with(searchKey, :searchKey)',
			ExpressionAttributeValues: {
				':clientId': clientId,
				':searchKey': '0#active#PE'
			},
			ScanIndexForward: true,
			ProjectionExpression: 'PK, #name, clientId, clientName, parentId, parentName',
			ExpressionAttributeNames: {
				'#name': 'name'
			}
		})
	);
	const results: ProductElement[] = [];
	for (const item of queryResult.Items || []) {
		results.push({
			id: extractId(item.PK, 'PE'),
			clientId: item.clientId,
			clientName: item.clientName,
			name: item.name
		});
	}
	return results;
}

export async function getChildProductElements(parent: ProductElement): Promise<ProductElement[]> {
	const queryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			IndexName: 'clientId-searchKey-index',
			KeyConditionExpression: 'clientId = :clientId AND begins_with(searchKey, :searchKey)',
			ExpressionAttributeValues: {
				':clientId': parent.clientId,
				':searchKey': `${parent.id}#active#PE#`
			},
			ScanIndexForward: true,
			ProjectionExpression: 'PK, #name, clientId, clientName, parentId, parentName',
			ExpressionAttributeNames: {
				'#name': 'name'
			}
		})
	);
	return (queryResult.Items ?? []).map((item) => {
		return {
			id: extractId(item.PK, 'PE'),
			clientId: item.clientId,
			clientName: item.clientName,
			name: item.name,
			parentId: item.parentId,
			parentName: item.parentName
		};
	});
}

export async function getProductElementById(id: number): Promise<ProductElement> {
	const metadataPromise = dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `PE#${id}`,
				SK: 'METADATA'
			},
			ExpressionAttributeNames: { '#name': 'name', '#type': 'type' },
			ProjectionExpression:
				'PK, SK, EntityId, #name, #type, content, clientId, clientName, parentId, parentName'
		})
	);

	const documentsPromise = await getProductElementDocuments(id);

	const [metadata, documents] = await Promise.all([metadataPromise, documentsPromise]);

	if (!metadata.Item) {
		throw new Error('Product element not found');
	}

	const result: ProductElement = {
		id: extractId(metadata.Item.PK, 'PE'),
		name: metadata.Item.name,
		clientId: metadata.Item.clientId,
		clientName: metadata.Item.clientName,
		parentId: metadata.Item.parentId,
		parentName: metadata.Item.parentName,
		documents
	};
	const children = await getChildProductElements(result);
	return { ...result, children };
}

export async function getProductElementDocuments(
	productElementId: number
): Promise<ProductElementDocument[]> {
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
				':parentKey': `PE#${productElementId}`,
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
			productElementId
		};
	});
}

export async function getProductElementDocumentById(
	productElementId: number,
	documentId: number
): Promise<ProductElementDocument> {
	const getResult = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: TABLE_NAME,
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

export async function getProductElementsForWorkItem(workItemId: number): Promise<ProductElement[]> {
	const workItemPK = `WI#${workItemId}`;

	// 1. Query the WI#<id> partition for all SKs that start with 'PE#'
	const linkQueryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			KeyConditionExpression: 'PK = :pk AND begins_with(SK, :pePrefix)',
			ExpressionAttributeValues: {
				':pk': workItemPK,
				':pePrefix': 'PE#'
			},
			ProjectionExpression: 'SK' // We only need the PE#<id> links
		})
	);

	const peKeys = (linkQueryResult.Items || []).map((item) => {
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
	const batchResult = await dynamoDBDocumentClient.send(
		new BatchGetCommand({
			RequestItems: {
				[TABLE_NAME]: {
					Keys: peKeys,
					ProjectionExpression: 'EntityId, #n, clientId, clientName',
					ExpressionAttributeNames: { '#n': 'name' }
				}
			}
		})
	);

	return (batchResult.Responses?.[TABLE_NAME] || []).map((item) => ({
		id: item.EntityId,
		name: item.name,
		clientId: item.clientId,
		clientName: item.clientName
	})) as ProductElement[];
}
