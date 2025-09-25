import type { ClientDocument } from '../../../../../types';
import { addClientDocument } from '$lib/server/repositories/clientRepository';
import { redirect } from '@sveltejs/kit';

export async function load({params}) {
	const clientId = params.id
	return {
		clientId: clientId,
	}
}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData()
		const clientId =+(data.get('clientId') as string)
		const clientDocument: ClientDocument = {
			clientId,
			name: data.get('name') as string,
			type: data.get('type') as string,
			content: data.get('content') as string,
		}
		await addClientDocument(clientDocument)
		redirect(303, `/clients/${clientId}`)
	}
}