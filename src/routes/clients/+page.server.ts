import { getClients } from '$lib/server/repositories/clientRepository';

export async function load() {
	const clients = await getClients();
	return {
		clients
	}
}