import { getProductElementById } from '$lib/server/repositories/productElementRepository';

export async function load({ params }) {
	const id = params.id;
	const productElement = await getProductElementById(+id);
	return {
		productElement
	};
}
