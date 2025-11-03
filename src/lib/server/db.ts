import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
	region: "US-EAST-1",
	profile: "cleareye-workapp-account",
})

// This client is instantiated ONCE when the module loads
export const dynamoDBDocumentClient = DynamoDBDocumentClient.from(client);

export const getTableName = () => "work-app"

export async function getNextSequenceNumber(prefix: string): Promise<number> {
	// We use a specific item (PK='COUNTER', SK=prefix) to hold the counter
	const updateParams = new UpdateCommand({
		TableName: getTableName(),
		Key: {
			PK: "COUNTER", // Hardcoded partition key for all counters
			SK: prefix,    // Sort key for the specific counter (CLIENT, WI, PE)
		},
		// The ADD operator is key: it atomically increments 'current_id'
		UpdateExpression: "ADD current_id :inc",
		ExpressionAttributeValues: {
			":inc": 1,
		},
		// Crucial: Tell DynamoDB to return the new, updated value
		ReturnValues: "UPDATED_NEW",
	});

	const response = await dynamoDBDocumentClient.send(updateParams);

	// Return the new ID from the response
	// Note: DynamoDB returns numbers as strings in the low-level API, but lib-dynamodb converts them
	return response.Attributes?.current_id as number;
}