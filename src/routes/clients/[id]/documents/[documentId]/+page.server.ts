import type { ClientDocument } from '../../../../../types';
import {
	getClientDocumentById,
	updateClientDocument
} from '$lib/server/repositories/clientRepository';
import { redirect } from '@sveltejs/kit';

export async function load({ params }) {
	const id = params.id;
	const documentId = params.documentId;
	const document = await getClientDocumentById(+id, +documentId);
	return {
		document
	};
}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const clientId = +(data.get('clientId') as string);
		const clientDocument: ClientDocument = {
			id: +(data.get('id') as string),
			clientId,
			name: data.get('name') as string,
			type: data.get('type') as string,
			content: data.get('content') as string
		};
		await updateClientDocument(clientDocument);
		redirect(303, `/clients/${clientId}`);
	}
};
