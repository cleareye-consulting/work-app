import { addClientSummary, getClientById, updateClient } from '$lib/server/repositories/clientRepository';
import type { Client } from '../../../types';
import { redirect } from '@sveltejs/kit';
import { getTimeEntriesByClientAndRange } from '$lib/server/repositories/timeRepository';

export async function load({ params, url }) {
	const id = params.id;
	const client = await getClientById(+id);

	const period = url.searchParams.get('period') || 'this-month';
	const now = new Date();
	let startOfMonth: Date;
	let endOfMonth: Date;

	if (period === 'last-month') {
		startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		endOfMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
	} else {
		startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
	}

	const timeEntries = await getTimeEntriesByClientAndRange(
		+id,
		startOfMonth.toISOString(),
		endOfMonth.toISOString()
	);

	const timeByWorkItem: Record<number, number> = {};
	for (const entry of timeEntries) {
		if (entry.startTime && entry.endTime) {
			const start = new Date(entry.startTime).getTime();
			const end = new Date(entry.endTime).getTime();
			const durationHours = (end - start) / (1000 * 60 * 60);

			timeByWorkItem[entry.workItemId] = (timeByWorkItem[entry.workItemId] || 0) + durationHours;
		}
	}

	const monthlyTimeSummary = Object.entries(timeByWorkItem)
		.map(([workItemId, hours]) => ({
			workItemId: +workItemId,
			hours: Math.round(hours * 100) / 100
		}))
		.sort((a, b) => a.workItemId - b.workItemId);

	return {
		client,
		monthlyTimeSummary,
		period
	};
}

export const actions = {
	updateClient: async ({ request }) => {
		const data = await request.formData();
		const client: Client = {
			id: +(data.get('id') as string),
			name: data.get('name') as string,
			isActive: data.has('isActive')
		};
		await updateClient(client);
		redirect(303, '/clients');
	}
};