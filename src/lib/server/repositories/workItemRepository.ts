import type { WorkItemDocument, WorkItem } from '../../../types';
import {
	dynamoDBDocumentClient,
	extractId,
	getNextSequenceNumber,
	TABLE_NAME,
	TOP_LEVEL_PARENT_ID,
	TOP_LEVEL_PARENT_NAME
} from '$lib/server/db';
import {
	GetCommand,
	PutCommand,
	QueryCommand,
	TransactWriteCommand,
	UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { getActiveStatuses } from '../utils';

function getSearchKey(item: WorkItem, partitionKey: string): string {
	const parentId = item.parentId ?? TOP_LEVEL_PARENT_ID;
	const active = getActiveStatuses().includes(item.status) ? 'active' : 'inactive';
	return `${parentId}#${active}#${partitionKey}`;
}

export async function addWorkItem(item: WorkItem): Promise<number> {
	const newId = await getNextSequenceNumber('WI');
	const partitionKey = `WI#${newId}`;
	const metaDataItem = {
		PK: partitionKey,
		SK: 'METADATA',
		searchKey: getSearchKey(item, partitionKey),
		name: item.name,
		type: item.type,
		status: item.status,
		clientId: item.clientId,
		clientName: item.clientName,
		parentId: item.parentId ?? TOP_LEVEL_PARENT_ID,
		parentName: item.parentName ?? TOP_LEVEL_PARENT_NAME,
		description: item.description ?? null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
	const peLinkItems = [];
	for (const peId of item.productElementIds ?? []) {
		peLinkItems.push({
			PK: `PE#${peId}`,
			SK: `WI#${newId}`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
		peLinkItems.push({
			PK: `WI#${newId}`,
			SK: `PE#${peId}`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
	}

	await dynamoDBDocumentClient.send(
		new TransactWriteCommand({
			TransactItems: [metaDataItem, ...peLinkItems].map((item) => {
				return {
					Put: {
						TableName: TABLE_NAME,
						Item: item
					}
				};
			})
		})
	);
	return newId;
}

export async function addWorkItemDocument(item: WorkItemDocument): Promise<number> {
	const newId = await getNextSequenceNumber('DOC-WI');
	await dynamoDBDocumentClient.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: {
				PK: `WI#${item.workItemId}`,
				SK: `DOC#${newId}`,
				name: item.name,
				type: item.type,
				content: item.content,
				summary: item.summary ?? null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}
		})
	);
	return newId;
}

// Helper function to safely fetch existing PE links
async function getCurrentPELinks(workItemId: number): Promise<string[]> {
	// Query the main table for all SKs starting with 'PE#' for this Work Item
	const queryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			KeyConditionExpression: 'PK = :pk AND begins_with(SK, :pePrefix)',
			ExpressionAttributeValues: {
				':pk': `WI#${workItemId}`,
				':pePrefix': 'PE#'
			},
			ProjectionExpression: 'SK' // Only need the Sort Key
		})
	);

	return (queryResult.Items || []).map((item) => item.SK.split('#')[1]);
}

export async function updateWorkItem(item: WorkItem) {
	const workItemPK = `WI#${item.id}`;
	const now = new Date().toISOString();

	const currentPEIds = await getCurrentPELinks(item.id!);
	const newPEIds = item.productElementIds ? item.productElementIds.map((id) => String(id)) : [];

	const idsToAdd = newPEIds.filter((id) => !currentPEIds.includes(id));
	const idsToRemove = currentPEIds.filter((id) => !newPEIds.includes(id));

	const fieldsToUpdate = {...item, updatedAt: now, searchKey: getSearchKey(item, workItemPK) };

	const expressions: string[] = [];
	const attributeNames: Record<string, string> = {};
	const attributeValues: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(fieldsToUpdate)) {
		// We use # to avoid conflicts with DynamoDB reserved words (like 'name', 'status', 'type')
		expressions.push(`#${key} = :${key}`);
		attributeNames[`#${key}`] = key;
		attributeValues[`:${key}`] = value ?? null; // DynamoDB doesn't like undefined
	}

	const transactItems = [];
	transactItems.push(
		{
			Update: {
				TableName: TABLE_NAME,
				Key: { PK: workItemPK, SK: 'METADATA' },
				UpdateExpression: `SET ${expressions.join(', ')}`,
				ExpressionAttributeNames: attributeNames,
				ExpressionAttributeValues: attributeValues
			}
		});

	for (const peId of idsToRemove) {
		// Delete the WI#<id> | PE#<id> link
		transactItems.push({
			Delete: {
				TableName: TABLE_NAME,
				Key: { PK: workItemPK, SK: `PE#${peId}` }
			}
		});
		// Delete the PE#<id> | WI#<id> link
		transactItems.push({
			Delete: {
				TableName: TABLE_NAME,
				Key: { PK: `PE#${peId}`, SK: workItemPK }
			}
		});
	}

	for (const peId of idsToAdd) {
		// Put the WI#<id> | PE#<id> link
		transactItems.push({
			Put: {
				TableName: TABLE_NAME,
				Item: { PK: workItemPK, SK: `PE#${peId}`, createdAt: now, updatedAt: now }
			}
		});
		// Put the PE#<id> | WI#<id> link
		transactItems.push({
			Put: {
				TableName: TABLE_NAME,
				Item: { PK: `PE#${peId}`, SK: workItemPK, createdAt: now, updatedAt: now }
			}
		});
	}
	await dynamoDBDocumentClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
}

export async function updateWorkItemDocument(item: WorkItemDocument) {
	await dynamoDBDocumentClient.send(
		new UpdateCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `WI#${item.workItemId}`,
				SK: `DOC#${item.id}`
			},
			UpdateExpression:
				'set #name = :name, #type = :type, #content = :content, #updatedAt = :updatedAt, summary = :summary',
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
				':updatedAt': new Date().toISOString(),
				':summary': item.summary ?? null
			}
		})
	);
}

export async function getTopLevelWorkItemsForClient(
	clientId: number,
	statuses: string[] | null
): Promise<WorkItem[]> {
	const queryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			IndexName: 'clientId-searchKey-index',
			KeyConditionExpression: 'clientId = :clientId AND begins_with(searchKey, :searchKey)',
			ExpressionAttributeValues: {
				':clientId': clientId,
				':searchKey': '0#active#WI#'
			},
			ScanIndexForward: true,
			ProjectionExpression: 'PK, entityType, #name, #type, #status, clientId, parentId',
			ExpressionAttributeNames: {
				'#name': 'name',
				'#type': 'type',
				'#status': 'status'
			}
		})
	);
	const results: WorkItem[] = [];
	for (const item of queryResult.Items || []) {
		if (statuses && !statuses.includes(item.status)) {
			continue;
		}
		results.push({
			id: extractId(item.PK, 'WI'),
			name: item.name,
			type: item.type,
			status: item.status,
			clientId: item.clientId,
			clientName: item.clientName,
			parentId: item.parentId,
			parentName: item.parentName
		});
	}
	return results;
}

export async function getChildWorkItems(
	parent: WorkItem,
	statuses: string[] | null
): Promise<WorkItem[]> {
	const queryResult = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			IndexName: 'clientId-searchKey-index',
			KeyConditionExpression: 'clientId = :clientId AND begins_with(searchKey, :searchKey)',
			ExpressionAttributeValues: {
				':clientId': parent.clientId,
				':searchKey': `${parent.id}#active#WI#`
			},
			ScanIndexForward: true,
			ProjectionExpression: 'PK, #name, #type, #status, clientId, parentId',
			ExpressionAttributeNames: {
				'#name': 'name',
				'#type': 'type',
				'#status': 'status'
			}
		})
	);
	const clientWorkItems = (queryResult.Items || []).map((item) => ({
		id: extractId(item.PK, 'WI'),
		name: item.name,
		type: item.type,
		status: item.status,
		clientId: item.clientId,
		parentId: item.parentId
	})) as WorkItem[];
	if (statuses) {
		return clientWorkItems.filter((item) => statuses.includes(item.status));
	}
	return clientWorkItems;
}

export async function getWorkItemById(id: number): Promise<WorkItem> {
	const getResponse = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `WI#${id}`,
				SK: 'METADATA'
			},
			ProjectionExpression:
				'PK, #name, #type, #status, clientId, clientName, parentId, parentName, description',
			ExpressionAttributeNames: {
				'#name': 'name',
				'#type': 'type',
				'#status': 'status'
			}
		})
	);
	if (!getResponse.Item) {
		throw new Error('Work item not found');
	}
	const workItem: WorkItem = {
		id: extractId(getResponse.Item.PK, 'WI'),
		name: getResponse.Item.name,
		type: getResponse.Item.type,
		status: getResponse.Item.status,
		parentId: getResponse.Item.parentId,
		parentName: getResponse.Item.parentName,
		clientId: getResponse.Item.clientId,
		clientName: getResponse.Item.clientName,
		description: getResponse.Item.description,
	};
	workItem.documents = await getWorkItemDocuments(id);
	workItem.children = await getChildWorkItems(workItem, null);
	return workItem;
}

export async function getWorkItemDocuments(workItemId: number): Promise<WorkItemDocument[]> {
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
				':parentKey': `WI#${workItemId}`,
				':docPrefix': 'DOC#'
			},
			ProjectionExpression: 'PK, SK, #name, #type, #content, summary',
			ScanIndexForward: true
		})
	);
	return (queryResult.Items ?? []).map((item) => {
		return {
			id: item.SK.split('#')[1],
			name: item.name,
			type: item.type,
			content: item.content,
			workItemId: workItemId,
			summary: item.summary ?? null,
		};
	});
}

export async function getWorkItemDocumentById(
	workItemId: number,
	documentId: number
): Promise<WorkItemDocument> {
	const getResult = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: `WI#${workItemId}`,
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
		throw new Error('Work item document not found');
	}
	return {
		id: documentId,
		name: getResult.Item.name,
		type: getResult.Item.type,
		content: getResult.Item.content,
		workItemId
	};
}
