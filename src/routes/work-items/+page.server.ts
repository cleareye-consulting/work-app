import { getClients } from '$lib/server/repositories/clientRepository';
import { getTopLevelWorkItemsForClient } from '$lib/server/repositories/workItemRepository';
import { getActiveStatuses } from '$lib/server/utils';

export async function load({ url }) {
	const clientIdParam = url.searchParams.get('clientId');
	const clientId = +(clientIdParam as string);
	const workItems = (await getTopLevelWorkItemsForClient(+clientId, null)).filter(wi => getActiveStatuses().includes(wi.status));
	const clients = (await getClients()).sort((a, b) => a.name.localeCompare(b.name));
	return {
		workItems,
		clients,
		clientId
	};
}
