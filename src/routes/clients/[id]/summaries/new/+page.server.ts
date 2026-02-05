import { addClientSummary, getClientSummaries } from '$lib/server/repositories/clientRepository';
import { getEventsForRange, getWorkItemDocuments } from '$lib/server/repositories/workItemRepository';
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
		
		// Fetch documents for each work item
		// Note: getWorkItemDocuments already filters by workItemId. 
		// Since we don't have a date filter on getWorkItemDocuments, 
		// we might get all documents for these work items.
		// However, the instructions say "retrieve the documents for those work items individually".
		const documents = (await Promise.all(
			workItemIds.map(id => getWorkItemDocuments(id, clientId))
		)).flat();

		const generatedContent = await generateClientSummary(
			lastSummary?.content || null,
			events,
			documents
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
