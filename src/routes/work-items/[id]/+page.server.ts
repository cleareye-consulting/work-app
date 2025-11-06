import { getWorkItemById, updateWorkItem } from '$lib/server/repositories/workItemRepository';
import {
	getActiveStatuses,
	workItemStatuses
} from '$lib/server/utils';
import {
	getProductElementsForClient,
	getProductElementsForWorkItem
} from '$lib/server/repositories/productElementRepository';
import { redirect } from '@sveltejs/kit';
import { getClientName } from '$lib/server/repositories/clientRepository.js';
import type { ProductElement } from '../../../types';

export async function load({ params }) {
	const id = params.id;
	const workItem = await getWorkItemById(+id);
	type ProductElementWithNestingLevel = ProductElement & { nestingLevel: number };
	const topLevelClientProductElements  = await getProductElementsForClient(workItem.clientId)
	const clientProductElements: ProductElementWithNestingLevel[] = [];

	const flattenAndAddNestingLevel = (pe: ProductElement, nestingLevel: number) => {
		clientProductElements.push({ ...pe, nestingLevel });
		const childNestingLevel = nestingLevel + 1;
		for (const child of pe.children ?? []) {
			flattenAndAddNestingLevel(child, childNestingLevel);
		}
	}

	for (const pe of topLevelClientProductElements) {
		flattenAndAddNestingLevel(pe, 0);
	}
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
		const productElementIds = data.getAll('productElementIds').map((id) => +(id as string));
		const clientName = await getClientName(clientId);
		await updateWorkItem({ id, name, type, parentId, clientId, clientName, status, description, productElementIds });

		const redirectUrl = parentId ? `/work-items/${parentId}` : `/work-items?clientId=${clientId}`;
		redirect(303, redirectUrl);
	}
};
