import { getClientById, getClients } from '$lib/server/repositories/clientRepository';
import { getProductElementById } from '$lib/server/repositories/productElementRepository';

export async function load({url})  {
	const clientIdParam = url.searchParams.get('clientId');
	const parentIdParam = url.searchParams.get('parentId');

	const clientId = clientIdParam ? parseInt(clientIdParam, 10) : null;
	const parentId = parentIdParam ? parseInt(parentIdParam, 10) : null;

	const parent  = parentId ? await getProductElementById(parentId) : null;

	const clients = await getClients()

	return {
		clientId,
		clients,
		parentId,
		parentName: parent?.name,
	}

}
