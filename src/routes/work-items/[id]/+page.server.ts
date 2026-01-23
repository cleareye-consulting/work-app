import { env } from '$env/dynamic/private';
import { getWorkItemById, updateWorkItem } from '$lib/server/repositories/workItemRepository';
import { getActiveStatuses, workItemStatuses, workItemTypes } from '$lib/server/utils';
import { redirect } from '@sveltejs/kit';
import { getClientName } from '$lib/server/repositories/clientRepository.js';

export async function load({ params }) {
	const id = params.id;
	const workItem = await getWorkItemById(+id);
	const activeStatuses = getActiveStatuses();
	return {
		workItem: {
			...workItem,
			documents: workItem.documents,
			children: workItem.children?.filter((wi) => activeStatuses.includes(wi.status))
		},
		workItemStatuses: workItemStatuses,
		workItemTypes: workItemTypes,
		featureFlags: {
			reparentWorkItems: env.FF_REPARENT_WORK_ITEMS === 'true'
		}
	};
}
export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const rawData = Object.fromEntries(formData.entries());
		const customFields: Record<string, string | number | boolean | null> = {};
		const clientName = await getClientName(+rawData.clientId);
		const workItemUpdate = {
			id: +rawData.id,
			name: rawData.name as string,
			description: rawData.description as string,
			type: rawData.type as string,
			status: rawData.status as string,
			clientId: +rawData.clientId,
			clientName,
			parentId: rawData.parentId ? +rawData.parentId : undefined,
			customFields
		};

		for (const [key, value] of Object.entries(rawData)) {
			if (key.startsWith('cf_')) {
				const actualKey = key.replace('cf_', '');
				workItemUpdate.customFields[actualKey] = value as string | number | boolean | null;
			}
		}

		await updateWorkItem(workItemUpdate);

		const redirectUrl = workItemUpdate.parentId ? `/work-items/${workItemUpdate.parentId}` : `/work-items?clientId=${workItemUpdate.clientId}`;
		redirect(303, redirectUrl);
	}
};
