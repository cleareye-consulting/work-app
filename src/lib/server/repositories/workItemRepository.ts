import type { WorkItemDocument, WorkItem, WorkItemChangeEvent } from '../../../types';
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
	type TransactWriteCommandInput,
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
		customFields: item.customFields ?? {},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	await dynamoDBDocumentClient.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: metaDataItem
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

export async function updateWorkItem(item: WorkItem) {
	const pk = `WI#${item.id}`;
	const oldItem = await getWorkItemById(item.id!);
	const now = new Date().toISOString();
	const changes = [];

	if (item.status !== oldItem.status) {
		changes.push(`Status: ${oldItem.status} → ${item.status}`);
	}

	const oldFields = oldItem.customFields || {};
	const fields = item.customFields || {};

	for (const key in fields) {
		if (fields[key] !== oldFields[key]) {
			changes.push(`${key}: ${oldFields[key] ?? 'None'} → ${fields[key]}`);
		}
	}

	const transactItems: NonNullable<TransactWriteCommandInput['TransactItems']> = [
		{
			Update: {
				TableName: TABLE_NAME,
				Key: { PK: pk, SK: 'METADATA' },
				UpdateExpression: `SET 
          #n = :n, #t = :t, #s = :s, 
          searchKey = :sk, parentId = :pid, 
          description = :desc, customFields = :cf, 
          updatedAt = :updatedAt`,
				ExpressionAttributeNames: { '#n': 'name', '#t': 'type', '#s': 'status' },
				ExpressionAttributeValues: {
					':n': item.name,
					':t': item.type,
					':s': item.status,
					':sk': getSearchKey(item, pk),
					':pid': item.parentId ?? TOP_LEVEL_PARENT_ID,
					':desc': item.description || null,
					':cf': item.customFields || {},
					':updatedAt': now
				}
			}
		}
	];

	if (changes.length > 0) {
		transactItems.push({
			Put: {
				TableName: TABLE_NAME,
				Item: {
					PK: pk,
					SK: `EVT#${now}`,
					itemType: 'EVENT',
					clientId: item.clientId,
					content: changes.join(' | '),
					createdAt: now
				}
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
				'#updatedAt': 'updatedAt'
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
			parentName: item.parentName,
			customFields: {}
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
				'PK, #name, #type, #status, clientId, clientName, parentId, parentName, description, customFields',
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
		customFields: getResponse.Item.customFields || {}
	};
	workItem.documents = await getWorkItemDocuments(id, workItem.clientId);
	workItem.children = await getChildWorkItems(workItem, null);
	return workItem;
}

export async function getWorkItemDocuments(
	workItemId: number,
	clientId: number
): Promise<WorkItemDocument[]> {
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
			clientId: clientId,
			summary: item.summary ?? null
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

export async function getEventsForRange(clientId: number, startDate: Date, endDate: Date): Promise<WorkItemChangeEvent[]> {
	const params = {
		TableName: TABLE_NAME,
		IndexName: 'ItemTypeIndex',
		KeyConditionExpression: 'itemType = :type AND createdAt BETWEEN :start AND :end',
		ExpressionAttributeValues: {
			':type': 'EVENT',
			':start': startDate.toISOString(),
			':end': endDate.toISOString()
		}
	};

	const response = await dynamoDBDocumentClient.send(new QueryCommand(params));
	const items = response.Items ?? [];

	return (
		items
			.filter((item) => item.clientId === clientId)
			.map((item) => ({
				workItemId: extractId(item.PK, 'WI'),
				createdAt: new Date(item.createdAt),
				summaryOfChanges: item.content || ''
			}))
	);
}
