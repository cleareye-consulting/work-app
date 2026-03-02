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
	type TransactWriteCommandInput
} from '@aws-sdk/lib-dynamodb';
import type { TimeEntry, TimeTrackingStatus } from '../../../types';

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
