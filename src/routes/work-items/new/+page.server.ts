import { getClientName, getClients } from '$lib/server/repositories/clientRepository';
import { redirect } from '@sveltejs/kit';
import { addWorkItem, getWorkItemById } from '$lib/server/repositories/workItemRepository';
import { workItemStatuses, workItemTypes } from '$lib/server/utils';

export async function load({ url }) {
	const clientIdParam = url.searchParams.get('clientId');
	const parentIdParam = url.searchParams.get('parentId');

	const parentId = parentIdParam ? parseInt(parentIdParam, 10) : null;

	const parent = parentId ? await getWorkItemById(parentId) : null;
	const clientId = parent?.clientId ?? (clientIdParam ? parseInt(clientIdParam, 10) : null);

	const clients = await getClients();
	const parentTypeKey = parent?.type ?? '_CLIENT_';
	const workItemTypeOptions: string[] = []
	for (const workItemTypeLabel in workItemTypes) {
		if (workItemTypes[workItemTypeLabel].parentTypes.includes(parentTypeKey)) {
			workItemTypeOptions.push(workItemTypeLabel);
		}
	}

	return {
		clientId,
		clients,
		parentId,
		parentName: parent?.name,
		workItemTypeOptions: workItemTypeOptions,
		workItemTypes: workItemTypes,
		workItemStatuses: workItemStatuses
	};
}

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const rawData = Object.fromEntries(formData.entries());
		const customFields: Record<string, string | number | boolean | null> = {};
		const clientName = await getClientName(+rawData.clientId);

		const newWorkItem = {
			name: rawData.name as string,
			description: rawData.description as string,
			type: rawData.type as string,
			status: 'NEW',
			clientId: +rawData.clientId,
			clientName,
			parentId: rawData.parentId ? +rawData.parentId : undefined,
			customFields
		};

		for (const [key, value] of Object.entries(rawData)) {
			if (key.startsWith('cf_')) {
				const actualKey = key.replace('cf_', '');
				newWorkItem.customFields[actualKey] = value as string | number | boolean | null;
			}
		}

		await addWorkItem(newWorkItem);

		const redirectUrl = newWorkItem.parentId
			? `/work-items/${newWorkItem.parentId}`
			: `/work-items?clientId=${newWorkItem.clientId}`;

		redirect(303, redirectUrl);
	}
};
