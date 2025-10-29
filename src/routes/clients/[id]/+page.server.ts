import { getClientById, updateClient } from '$lib/server/repositories/clientRepository';
import type { Client } from '../../../types';
import { redirect } from '@sveltejs/kit';

export async function load({params}) {
	const id = params.id
	const client = await getClientById(+id)
	return {
		client
	}
}

export const actions = {
	default: async ({request}) => {
		const data = await request.formData()
		const client: Client =
  	{
			id: +(data.get('id') as string),
			name: data.get("name") as string,
			isActive: data.has('isActive'),
		}
		await updateClient(client)
		redirect(303, "/clients")
	}
}