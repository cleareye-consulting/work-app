import { getClients } from '$lib/server/repositories/clientRepository';
import {
	addProductElement,
	getProductElementById
} from '$lib/server/repositories/productElementRepository';
import { redirect } from '@sveltejs/kit';

export async function load({url})  {
	const clientIdParam = url.searchParams.get('clientId');
	const parentIdParam = url.searchParams.get('parentId');

	const parentId = parentIdParam ? parseInt(parentIdParam, 10) : null;

	const parent  = parentId ? await getProductElementById(parentId) : null;
	const clientId = parent?.clientId ?? (clientIdParam ? parseInt(clientIdParam, 10) : null);

	const clients = await getClients()

	return {
		clientId,
		clients,
		parentId,
		parentName: parent?.name,
	}

}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		console.log(data);
		const name = data.get('name') as string;
		const clientId = +(data.get('clientId') as string);
		const parentIdFormValue: string | null = data.get('parentProductElementId') as string;
		const parentProductElementId = parentIdFormValue ? +parentIdFormValue : undefined;

	  await addProductElement({ name, clientId, parentProductElementId });
	 	const redirectUrl = parentProductElementId ? `/product-elements/${parentProductElementId}` : `/product-elements`;

		redirect(303, redirectUrl);
	}
};
