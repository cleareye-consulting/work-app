import { getProductElements } from '$lib/server/repositories/productElementRepository';
import { getClients } from '$lib/server/repositories/clientRepository';

export async function load({url})  {
	// Read query parameters from the URL
	const clientIdParam = url.searchParams.get('clientId');
	const parentIdParam = url.searchParams.get('parentId');

	// Convert string parameters to number or null, ensuring null is passed if empty
	const clientId = clientIdParam ? parseInt(clientIdParam, 10) : null;
	const parentId = parentIdParam ? parseInt(parentIdParam, 10) : null;

	// Call the database function with the filters
	const productElements = await getProductElements(parentId, clientId);

	 const clients = await getClients();

	return {
		productElements,
		clients,
		currentClientId: clientId,
		currentParentId: parentId
	}
}