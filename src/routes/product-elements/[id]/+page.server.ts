import {
	getProductElementById,
	getProductElementDocuments,
	getProductElements
} from '$lib/server/repositories/productElementRepository';

export async function load({params}) {
	const id = params.id
	const productElement = await getProductElementById(+id)
	const children = await getProductElements(+id, null)
	const documents = await getProductElementDocuments(+id)
	return {
		productElement: {...productElement, children, documents},
	}
}
