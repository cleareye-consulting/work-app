import { getClients } from '$lib/server/repositories/clientRepository';
import { redirect } from '@sveltejs/kit';
import {
	addWorkItem,
	getWorkItemById,
} from '$lib/server/repositories/workItemRepository';
import { getAllProductElementsForClient } from '$lib/server/repositories/productElementRepository';
import {
	flatMapClientProductElements,
	workItemStatuses,
	workItemTypes
} from '$lib/server/utils';

export async function load({url})  {
	const clientIdParam = url.searchParams.get('clientId');
	const parentIdParam = url.searchParams.get('parentId');

	const parentId = parentIdParam ? parseInt(parentIdParam, 10) : null;

	const parent  = parentId ? await getWorkItemById(parentId) : null;
	const clientId = parent?.clientId ?? (clientIdParam ? parseInt(clientIdParam, 10) : null);

	const clients = await getClients()

	const clientProductElements
		= flatMapClientProductElements(await getAllProductElementsForClient(clientId))
	return {
		clientId,
		clients,
		parentId,
		parentName: parent?.name,
		clientProductElements,
		workItemTypes: workItemTypes,
		workItemStatuses: workItemStatuses,
	}

}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const name = data.get('name') as string;
		const description = data.get('description') as string;
		const clientId = +(data.get('clientId') as string);
		const parentIdFormValue: string | null = data.get('parentId') as string;
		const parentId = parentIdFormValue ? +parentIdFormValue : undefined;
		const type = data.get('type') as string;
		const productElementIdsRaw = data.getAll('productElementIds');
		const productElementIds = productElementIdsRaw.map(id => +(id as string));
		await addWorkItem({ name, clientId, parentId, type, productElementIds, description, status: 'NEW' });

	 	const redirectUrl = parentId ? `/work-items/${parentId}` : '/work-items';

		redirect(303, redirectUrl);
	}
};
