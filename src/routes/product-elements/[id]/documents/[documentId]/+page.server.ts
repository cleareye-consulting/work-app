import type { ProductElementDocument } from '../../../../../types';
import { redirect } from '@sveltejs/kit';
import {
	getProductElementDocumentById,
	updateProductElementDocument
} from '$lib/server/repositories/productElementRepository';

export async function load({params}) {
	const documentId = params.documentId
	const document = await getProductElementDocumentById(documentId);
	return {
		document
	}
}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData()
		const productElementId =+(data.get('productElementId') as string)
		const productElementDocument: ProductElementDocument = {
			id: +(data.get('id') as string),
			productElementId,
			name: data.get('name') as string,
			type: data.get('type') as string,
			content: data.get('content') as string,
		}
		await updateProductElementDocument(productElementDocument)
		redirect(303, `/product-elements/${productElementId}`)
	}
}