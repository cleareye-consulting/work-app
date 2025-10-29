import type { ProductElementDocument } from '../../../../../types';
import { redirect } from '@sveltejs/kit';
import { addProductElementDocument } from '$lib/server/repositories/productElementRepository';

export async function load({params}) {
	const productElementId = params.id
	return {
		productElementId: productElementId,
	}
}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData()
		const productElementId =+(data.get('productElementId') as string)
		const productElementDocument: ProductElementDocument = {
			productElementId,
			name: data.get('name') as string,
			type: data.get('type') as string,
			content: data.get('content') as string,
		}
		await addProductElementDocument(productElementDocument)
		redirect(303, `/product-elements/${productElementId}`)
	}
}