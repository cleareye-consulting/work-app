import type { Client } from '../../../types';
import { addClient } from '$lib/server/repositories/clientRepository';
import { redirect } from '@sveltejs/kit';

export const actions = {
	default: async ({request}) =>  {
		const data = await request.formData()
		const client: Client = {
			name: data.get("name") as string,
			isActive: true
		}
		await addClient(client)
		redirect(303, "/clients")
	}
}