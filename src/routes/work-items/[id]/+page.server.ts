import {
	getWorkItemById,
	getWorkItemDocuments,
	getWorkItems,
	updateWorkItem
} from '$lib/server/repositories/workItemRepository';
import { flatMapClientProductElements, workItemStatuses } from '$lib/server/utils';
import { getAllProductElementsForClient, getProductElementsForWorkItem } from '$lib/server/repositories/productElementRepository';
import { redirect } from '@sveltejs/kit';

export async function load({params}) {
	const id = params.id
	const workItem = await getWorkItemById(+id)
	const children = await getWorkItems(+id, null)
	const documents = await getWorkItemDocuments(+id)
	const clientProductElements
		= flatMapClientProductElements(await getAllProductElementsForClient(workItem!.clientId))
	const workItemProductElements = await getProductElementsForWorkItem(+id)
	return {
		workItem: {...workItem, children, documents},
		clientProductElements,
		workItemProductElements,
		workItemStatuses: workItemStatuses,
	}
}
export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const id = +(data.get('id') as string);
		const name = data.get('name') as string;
		const type = data.get('type') as string;
		const parentIdFormValue: string | null = data.get('parentId') as string;
		const parentId = parentIdFormValue ? +parentIdFormValue : undefined;
		const clientId = +(data.get('clientId') as string);
		const status = data.get('status') as string;
		await updateWorkItem({ id, name, type, parentId, clientId, status})

		const redirectUrl = parentId ? `/work-items/${parentId}` : '/work-items';
		redirect(303, redirectUrl);
	}
};
