import { getWorkItemById, updateWorkItem } from '$lib/server/repositories/workItemRepository';
import {
	flatMapClientProductElements,
	getActiveStatuses,
	workItemStatuses
} from '$lib/server/utils';
import {
	getProductElementsForClient,
	getProductElementsForWorkItem
} from '$lib/server/repositories/productElementRepository';
import { redirect } from '@sveltejs/kit';
import { getClientName } from '$lib/server/repositories/clientRepository.js';

export async function load({ params }) {
	const id = params.id;
	const workItem = await getWorkItemById(+id);
	const clientProductElements = flatMapClientProductElements(
		await getProductElementsForClient(workItem!.clientId, false)
	);
	const workItemProductElements = await getProductElementsForWorkItem(+id);
	const activeStatuses = getActiveStatuses();
	return {
		workItem: {
			...workItem,
			documents: workItem.documents,
			children: workItem.children?.filter((wi) => activeStatuses.includes(wi.status))
		},
		clientProductElements,
		workItemProductElements,
		workItemStatuses: workItemStatuses
	};
}
export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const id = +(data.get('id') as string);
		const name = data.get('name') as string;
		const description = data.get('description') as string;
		const type = data.get('type') as string;
		const parentIdFormValue: string | null = data.get('parentId') as string;
		const parentId = parentIdFormValue ? +parentIdFormValue : undefined;
		const clientId = +(data.get('clientId') as string);
		const status = data.get('status') as string;
		const clientName = await getClientName(clientId);
		await updateWorkItem({ id, name, type, parentId, clientId, clientName, status, description });

		const redirectUrl = parentId ? `/work-items/${parentId}` : `/work-items?clientId=${clientId}`;
		redirect(303, redirectUrl);
	}
};
