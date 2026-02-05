import { addClientSummary } from '$lib/server/repositories/clientRepository';
import { redirect } from '@sveltejs/kit';

export async function load({ params }) {
	return {
		clientId: params.id
	};
}

export const actions = {
	default: async ({ request, params }) => {
		const data = await request.formData();
		const clientId = params.id;
		const content = data.get('content') as string;

		await addClientSummary(clientId, content);
		
		redirect(303, `/clients/${clientId}`);
	}
};
