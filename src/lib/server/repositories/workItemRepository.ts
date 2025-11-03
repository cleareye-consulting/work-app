import type { WorkItemDocument, WorkItem  } from '../../../types';
import { dynamoDBDocumentClient, getNextSequenceNumber, getTableName } from '$lib/server/db';
import {
	GetCommand,
	PutCommand,
	QueryCommand,
	TransactWriteCommand,
	UpdateCommand
} from '@aws-sdk/lib-dynamodb';

export async function getTopLevelWorkItemsForClient(clientId: number, statuses: string[] | null): Promise<WorkItem[]> {
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		IndexName: 'clientId-index',
		KeyConditionExpression: 'ClientId = :clientId',
		ExpressionAttributeValues: {
			':clientId': clientId,
		},
		ScanIndexForward: true,
		ProjectionExpression: 'id, #name, type, status, clientId, parentId',
		ExpressionAttributeNames: {
			'#name': 'name'
		}
	}))
	const results: WorkItem[] = [];
	for (const item of queryResult.Items || []) {
		if (item.parentId !== null) {
			continue;
		}
		if (statuses && !statuses.includes(item.status)) {
			continue;
		}
		results.push({
			id: item.entityId,
			name: item.name,
			type: item.type,
			status: item.status,
			clientId: item.clientId,
			clientName: item.clientName,
			parentId: item.parentId,
			parentName: item.parentName
		});
	}
	return results

}

export async function getChildWorkItems(parentId: number, statuses: string[] | null): Promise<WorkItem[]> {
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		IndexName: 'parentId-index',
		KeyConditionExpression: 'ParentId = :parentId',
		ExpressionAttributeValues: {
			':parentId': parentId,
		},
		ScanIndexForward: true,
		ProjectionExpression: 'id, #name, type, status, clientId, parentId',
		ExpressionAttributeNames: {
			'#name': 'name'
		}
	}))
	const clientWorkItems = (queryResult.Items || []).map(item => ({
		id: item.entityId,
		name: item.name,
		type: item.type,
		status: item.status,
		clientId: item.clientId,
		parentId: item.parentId,
	})) as WorkItem[];
	if (statuses) {
		return clientWorkItems.filter(item => statuses.includes(item.status));
	}
	return clientWorkItems;
}


export async function getWorkItemById(id: number): Promise<WorkItem> {
	const getResponse = await dynamoDBDocumentClient.send(new GetCommand({
		TableName: getTableName(),
		Key: {
			PK: `WI#${id}`,
			SK: 'METADATA'
		},
		ProjectionExpression: '#name, type, status, clientId, clientName, parentId, parentName, description',
		ExpressionAttributeNames: {
			'#name': 'name',
		}
	}))
	if (!getResponse.Item) {
		throw new Error('Work item not found')
	}
	const workItem: WorkItem = {
		id: getResponse.Item.id,
		name: getResponse.Item.name,
		type: getResponse.Item.type,
		status: getResponse.Item.status,
		parentId: getResponse.Item.parentId,
		parentName: getResponse.Item.parentName,
		clientId: getResponse.Item.clientId,
		clientName: getResponse.Item.clientName,
		description: getResponse.Item.description
	}
	workItem.documents = await getWorkItemDocuments(id)
	return workItem
}

export async function addWorkItem(item: WorkItem): Promise<number> {
	const newId = await getNextSequenceNumber("WI")
	const metaDataItem = {
		PK: `WI#${newId}`,
		SK: 'METADATA',
		entityType: 'WI',
		entityId: newId,
		name: item.name,
		type: item.type,
		status: item.status,
		clientId: item.clientId,
		clientName: item.clientName,
		parentId: item.parentId ?? null,
		parentName: item.parentName ?? null,
		description: item.description ?? null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	}
	const peLinkItems = []
	for (const peId of item.productElementIds ?? []) {
		peLinkItems.push({
			PK: `PE#${peId}`,
			SK: `WI#${newId}`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
		peLinkItems.push({
			PK: `WI#${newId}`,
			SK: `PE#${peId}`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		})
	}

	await dynamoDBDocumentClient.send(new TransactWriteCommand({
		TransactItems: [metaDataItem, ...peLinkItems].map(item => {
		return {
				Put: {
					TableName: getTableName(),
					Item: item
				}
		}})
		})
	)
	return newId;
}

// Helper function to safely fetch existing PE links
async function getCurrentPELinks(workItemId: number): Promise<string[]> {
	// Query the main table for all SKs starting with 'PE#' for this Work Item
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		KeyConditionExpression: 'PK = :pk AND begins_with(SK, :pePrefix)',
		ExpressionAttributeValues: {
			':pk': `WI#${workItemId}`,
			':pePrefix': 'PE#',
		},
		ProjectionExpression: 'SK' // Only need the Sort Key
	}));

	return (queryResult.Items || []).map(item => item.SK.split('#')[1]);
}

export async function updateWorkItem(item: WorkItem) {
	const workItemPK = `WI#${item.id}`;
	const now = new Date().toISOString();

	const currentPEIds = await getCurrentPELinks(item.id!);
	const newPEIds = item.productElementIds ? item.productElementIds.map(id => String(id)) : [];

	const idsToAdd = newPEIds.filter(id => !currentPEIds.includes(id));
	const idsToRemove = currentPEIds.filter(id => !newPEIds.includes(id));

	const transactItems = [];

	transactItems.push({
		Update: {
			TableName: getTableName(),
			Key: { PK: workItemPK, SK: 'METADATA' },
			UpdateExpression: 'SET #n = :n, #t = :t, #s = :s, clientId = :cid, clientName = :cn, parentId = :pid, parentName = :pn, description = :desc, updatedAt = :updatedAt',
			ExpressionAttributeNames: {
				'#n': 'name',
				'#t': 'type',
				'#s': 'status',
			},
			ExpressionAttributeValues: {
				':n': item.name,
				':t': item.type,
				':s': item.status,
				':cid': item.clientId,
				':cn': item.clientName,
				':pid': item.parentId ?? null,
				':pn': item.parentName ?? null,
				':desc': item.description ?? null,
				':updatedAt': now,
			},
		}
	});

	for (const peId of idsToRemove) {
		// Delete the WI#<id> | PE#<id> link
		transactItems.push({ Delete: {
				TableName: getTableName(),
				Key: { PK: workItemPK, SK: `PE#${peId}` }
			}});
		// Delete the PE#<id> | WI#<id> link
		transactItems.push({ Delete: {
				TableName: getTableName(),
				Key: { PK: `PE#${peId}`, SK: workItemPK }
			}});
	}

	for (const peId of idsToAdd) {
		// Put the WI#<id> | PE#<id> link
		transactItems.push({ Put: {
				TableName: getTableName(),
				Item: { PK: workItemPK, SK: `PE#${peId}`, createdAt: now, updatedAt: now }
			}});
		// Put the PE#<id> | WI#<id> link
		transactItems.push({ Put: {
				TableName: getTableName(),
				Item: { PK: `PE#${peId}`, SK: workItemPK, createdAt: now, updatedAt: now }
			}});
	}

	await dynamoDBDocumentClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
}


export async function getWorkItemDocuments(workItemId: number): Promise<WorkItemDocument[]>{
	const queryResult = await dynamoDBDocumentClient.send(new QueryCommand({
		TableName: getTableName(),
		KeyConditionExpression: 'PK = :parentKey AND begins_with(SK, :docPrefix)',
		ExpressionAttributeNames: {
			'#name': 'name',
			'#type': 'type',
			'#content': 'content',
		},
		ExpressionAttributeValues: {
			":parentKey": `WI#${workItemId}`,
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
			workItemId: workItemId
		}
	})
}

export async function getWorkItemDocumentById(workItemId: number, documentId: number): Promise<WorkItemDocument> {
	const getResult = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: getTableName(),
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

export async function addWorkItemDocument(item: WorkItemDocument): Promise<number> {
	const newId = await getNextSequenceNumber("DOC-WI")
	await dynamoDBDocumentClient.send(new PutCommand({
		TableName: getTableName(),
		Item: {
			PK: `WI#${item.workItemId}`,
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

export async function updateWorkItemDocument(item: WorkItemDocument) {
	await dynamoDBDocumentClient.send(new UpdateCommand({
		TableName: getTableName(),
		Key: {
			PK: `WI#${item.workItemId}`,
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

