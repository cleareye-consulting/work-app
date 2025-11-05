import { getClients } from '$lib/server/repositories/clientRepository';
import { getProductElementsForClient } from '$lib/server/repositories/productElementRepository';
import type { ProductElement } from '../../types.js';

export async function load({ url }) {
	const clientIdParam = url.searchParams.get('clientId');

	const clientId = clientIdParam ? parseInt(clientIdParam, 10) : null;
	let productElements: ProductElement[] = [];
	if (clientId) {
		productElements = await getProductElementsForClient(clientId, true);
	} // else keep the empty array

	const clients = await getClients();

	return {
		productElements,
		clients,
		clientId
	};
}
