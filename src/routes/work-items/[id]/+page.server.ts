import {
	getWorkItemById,
	getWorkItemDocuments,
	getWorkItems
} from '$lib/server/repositories/workItemRepository';

export async function load({params}) {
	const id = params.id
	const workItem = await getWorkItemById(+id)
	const children = await getWorkItems(+id, null)
	const documents = await getWorkItemDocuments(+id)
	return {
		workItem: {...workItem, children, documents}
	}
}
