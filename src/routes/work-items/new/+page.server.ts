import { getClients } from '$lib/server/repositories/clientRepository';
import { redirect } from '@sveltejs/kit';
import {
	addWorkItem,
	getWorkItemById,
	getWorkItemTypes
} from '$lib/server/repositories/workItemRepository';

export async function load({url})  {
	const clientIdParam = url.searchParams.get('clientId');
	const parentIdParam = url.searchParams.get('parentId');

	const parentId = parentIdParam ? parseInt(parentIdParam, 10) : null;

	const parent  = parentId ? await getWorkItemById(parentId) : null;
	const clientId = parent?.clientId ?? (clientIdParam ? parseInt(clientIdParam, 10) : null);

	const clients = await getClients()
	const workItemTypes = await getWorkItemTypes()

	return {
		clientId,
		clients,
		parentId,
		parentName: parent?.name,
		workItemTypes,
	}

}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name') as string;
		const clientId = +(data.get('clientId') as string);
		const parentIdFormValue: string | null = data.get('parentId') as string;
		const parentId = parentIdFormValue ? +parentIdFormValue : undefined;
		const workItemTypeId = +(data.get('workItemTypeId') as string);

		await addWorkItem({ name, clientId, parentId, workItemTypeId });

	 	const redirectUrl = parentId ? `/work-items/${parentId}` : '/work-items';

		redirect(303, redirectUrl);
	}
};
