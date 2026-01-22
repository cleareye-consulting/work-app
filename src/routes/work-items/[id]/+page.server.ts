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
import type { ProductElement, WorkItemType } from '../../../types';

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
		const formData = await request.formData();
		const rawData = Object.fromEntries(formData.entries());

		const {
			id,
			name,
			description,
			type,
			parentId,
			clientId,
			status,
			...customFields
		} = rawData;

		const workItemUpdate = {
			id: +id,
			name: name as string,
			type: type as WorkItemType,
			description: description as string,
			status: status as string,
			clientId: +clientId,
			parentId: parentId ? +parentId : undefined,
			productElementIds: formData.getAll('productElementIds').map(Number)
		};
		console.log(workItemUpdate);

		const clientName = await getClientName(workItemUpdate.clientId);
		await updateWorkItem({...workItemUpdate, ...customFields, clientName});

		const redirectUrl = parentId ? `/work-items/${parentId}` : `/work-items?clientId=${clientId}`;
		redirect(303, redirectUrl);
	}
};
