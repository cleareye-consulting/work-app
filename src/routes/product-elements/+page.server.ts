import {
	getProductElementById,
	getProductElements
} from '$lib/server/repositories/productElementRepository';
import { getClients } from '$lib/server/repositories/clientRepository';

export async function load({url})  {
	// Read query parameters from the URL
	const clientIdParam = url.searchParams.get('clientId');
	const parentIdParam = url.searchParams.get('parentId');

	// Convert string parameters to number or null, ensuring null is passed if empty
	const currentParentId = parentIdParam ? parseInt(parentIdParam, 10) : null;
	const currentParent = currentParentId ? await getProductElementById(currentParentId) : null;
	const currentClientId = clientIdParam ? parseInt(clientIdParam, 10) : currentParent?.clientId ?? null;

	// Call the database function with the filters
	const productElements = await getProductElements(currentParentId, currentClientId);

	 const clients = await getClients();

	return {
		productElements,
		clients,
		currentClientId,
		currentParentId,
		currentParentName: currentParent?.name,
	}
}