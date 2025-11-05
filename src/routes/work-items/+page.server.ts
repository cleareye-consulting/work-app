import { getClients } from '$lib/server/repositories/clientRepository';
import { getTopLevelWorkItemsForClient } from '$lib/server/repositories/workItemRepository';

export async function load({ url }) {
	const clientIdParam = url.searchParams.get('clientId');
	const clientId = +(clientIdParam as string);
	const workItems = await getTopLevelWorkItemsForClient(+clientId, null);
	const clients = await getClients();
	return {
		workItems,
		clients,
		clientId
	};
}
