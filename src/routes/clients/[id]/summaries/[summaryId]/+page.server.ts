import { getClientSummaryById, updateClientSummary } from '$lib/server/repositories/clientRepository';
import { redirect } from '@sveltejs/kit';
import type { ClientSummary } from '../../../../../types';

export async function load({ params }) {
	const clientId = params.id;
	const summaryId = params.summaryId;
	const summary = await getClientSummaryById(+clientId, summaryId);
	return {
		summary
	};
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();
		const clientId = params.id;
		const summaryId = params.summaryId;
		const content = data.get('content') as string;

		const summary: ClientSummary = {
			clientId: +clientId,
			createdAt: summaryId,
			content
		};

		await updateClientSummary(summary);

		redirect(303, `/clients/${clientId}`);
	}
};
