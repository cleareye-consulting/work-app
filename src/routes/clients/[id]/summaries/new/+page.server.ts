import {
	addClientSummary,
	getLatestClientSummary
} from '$lib/server/repositories/clientRepository';
import {
	getEventsForRange,
	getWorkItemById,
} from '$lib/server/repositories/workItemRepository';
import { type ClientSummaryWorkItemInput, generateClientSummary } from '$lib/server/ai';
import { redirect } from '@sveltejs/kit';
import type {  WorkItemChangeEvent } from '../../../../../types';

export async function load({ params }) {
	return {
		clientId: params.id
	};
}

async function getSummaryWorkItemInput(workItemId: number, allCurrentEvents: WorkItemChangeEvent[]): Promise<ClientSummaryWorkItemInput> {
	const workItem = await getWorkItemById(workItemId);
	const events = allCurrentEvents.filter(e => e.workItemId === workItemId);
	let parent: ClientSummaryWorkItemInput | null = null;
	if (workItem.parentId) {
		parent = await getSummaryWorkItemInput(workItem.parentId!, allCurrentEvents);
	}
	return {
		workItem,
		events,
		parent
	};
}

export const actions = {
	generate: async ({ params }) => {
		const clientId = +params.id;
		const lastSummary = await getLatestClientSummary(clientId);
		
		const startDate = lastSummary 
			? new Date(lastSummary.createdAt) 
			: new Date(0); // Beginning of time if no previous summary
		const endDate = new Date();

		const events = await getEventsForRange(clientId, startDate, endDate);
		
		const changedWorkItemIds = [...new Set(events.map(e => e.workItemId))];
		const summaryWorkItems = await Promise.all(changedWorkItemIds.map(id => getSummaryWorkItemInput(id, events)));
		const generatedContent = await generateClientSummary({
			lastSummary: lastSummary?.content ?? null,
			workItems: summaryWorkItems
		});

		return {
			generatedContent
		};
	},
	create: async ({ request, params }) => {
		const data = await request.formData();
		const clientId = params.id;
		const content = data.get('content') as string;

		await addClientSummary(clientId, content);
		
		redirect(303, `/clients/${clientId}`);
	}
};
