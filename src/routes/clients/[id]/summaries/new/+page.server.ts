import { addClientSummary, getClientSummaries } from '$lib/server/repositories/clientRepository';
import { getEventsForRange, getWorkItemDocuments, getWorkItemById } from '$lib/server/repositories/workItemRepository';
import { generateClientSummary } from '$lib/server/ai';
import { redirect } from '@sveltejs/kit';

export async function load({ params }) {
	return {
		clientId: params.id
	};
}

export const actions = {
	generate: async ({ params }) => {
		const clientId = +params.id;
		const summaries = await getClientSummaries(clientId);
		const lastSummary = summaries.length > 0 ? summaries[0] : null;
		
		const startDate = lastSummary 
			? new Date(lastSummary.createdAt) 
			: new Date(0); // Beginning of time if no previous summary
		const endDate = new Date();

		const events = await getEventsForRange(clientId, startDate, endDate);
		
		// Get unique work item IDs from events
		const workItemIds = [...new Set(events.map(e => e.workItemId))];
		
		// Fetch full work item details to get hierarchy and names
		const workItems = await Promise.all(
			workItemIds.map(id => getWorkItemById(id))
		);

		const workItemMap = new Map(workItems.map(wi => [wi.id, wi]));
		
		// Fetch documents for each work item
		const documents = (await Promise.all(
			workItemIds.map(id => getWorkItemDocuments(id))
		)).flat();

		const generatedContent = await generateClientSummary(
			lastSummary?.content || null,
			events,
			documents,
			workItems
		);

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
