import {
	dynamoDBDocumentClient,
	getNextSequenceNumber,
	TABLE_NAME
} from '$lib/server/db';
import {
	GetCommand,
	PutCommand,
	UpdateCommand,
	TransactWriteCommand,
	type TransactWriteCommandInput,
	QueryCommand
} from '@aws-sdk/lib-dynamodb';
import type { TimeEntry, TimeTrackingStatus } from '../../../types';

export async function getTimeEntriesByClientAndRange(
	clientId: number,
	startDate: string,
	endDate: string
): Promise<TimeEntry[]> {
	const response = await dynamoDBDocumentClient.send(
		new QueryCommand({
			TableName: TABLE_NAME,
			IndexName: 'time-clientId-startTime',
			KeyConditionExpression: 'clientId = :clientId AND startTime BETWEEN :startDate AND :endDate',
			ExpressionAttributeValues: {
				':clientId': clientId,
				':startDate': startDate,
				':endDate': endDate
			}
		})
	);

	return (response.Items ?? []).map((item) => ({
		id: item.PK.startsWith('TIME#') ? parseInt(item.PK.split('#')[1]) : undefined,
		workItemId: item.workItemId,
		clientId: item.clientId,
		startTime: item.startTime,
		endTime: item.endTime
	}));
}

export async function getTimeTrackingStatus(): Promise<TimeTrackingStatus> {
	const response = await dynamoDBDocumentClient.send(
		new GetCommand({
			TableName: TABLE_NAME,
			Key: {
				PK: 'TIME-MASTER',
				SK: 'CURRENT'
			}
		})
	);

	if (!response.Item) {
		return {};
	}

	return {
		activeTimeEntryId: response.Item.activeTimeEntryId,
		activeWorkItemId: response.Item.activeWorkItemId,
		activeClientId: response.Item.activeClientId
	};
}

export async function startTracking(workItemId: number, clientId: number): Promise<number> {
	const currentStatus = await getTimeTrackingStatus();
	const now = new Date().toISOString();
	const transactItems: NonNullable<TransactWriteCommandInput['TransactItems']> = [];

	// 1. Stop current tracking if exists
	if (currentStatus.activeTimeEntryId) {
		transactItems.push({
			Update: {
				TableName: TABLE_NAME,
				Key: {
					PK: `TIME#${currentStatus.activeTimeEntryId}`,
					SK: `WI#${currentStatus.activeWorkItemId}`
				},
				UpdateExpression: 'SET endTime = :now',
				ExpressionAttributeValues: {
					':now': now
				}
			}
		});
	}

	// 2. Create new tracking record
	const newTimeId = await getNextSequenceNumber('TIME');
	transactItems.push({
		Put: {
			TableName: TABLE_NAME,
			Item: {
				PK: `TIME#${newTimeId}`,
				SK: `WI#${workItemId}`,
				workItemId: workItemId,
				clientId: clientId,
				startTime: now
			}
		}
	});

	// 3. Update master record
	transactItems.push({
		Put: {
			TableName: TABLE_NAME,
			Item: {
				PK: 'TIME-MASTER',
				SK: 'CURRENT',
				activeTimeEntryId: newTimeId,
				activeWorkItemId: workItemId,
				updatedAt: now
			}
		}
	});

	await dynamoDBDocumentClient.send(
		new TransactWriteCommand({
			TransactItems: transactItems
		})
	);

	return newTimeId;
}

export async function stopTracking(timeEntryId: number, workItemId: number): Promise<void> {
	const now = new Date().toISOString();
	const transactItems: NonNullable<TransactWriteCommandInput['TransactItems']> = [
		{
			Update: {
				TableName: TABLE_NAME,
				Key: {
					PK: `TIME#${timeEntryId}`,
					SK: `WI#${workItemId}`
				},
				UpdateExpression: 'SET endTime = :now',
				ExpressionAttributeValues: {
					':now': now
				}
			}
		},
		{
			Delete: {
				TableName: TABLE_NAME,
				Key: {
					PK: 'TIME-MASTER',
					SK: 'CURRENT'
				}
			}
		}
	];

	await dynamoDBDocumentClient.send(
		new TransactWriteCommand({
			TransactItems: transactItems
		})
	);
}
