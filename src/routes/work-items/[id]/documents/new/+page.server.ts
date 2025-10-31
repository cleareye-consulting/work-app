import type { WorkItemDocument } from '../../../../../types';
import { redirect } from '@sveltejs/kit';
import { addWorkItemDocument } from '$lib/server/repositories/workItemRepository';
import { generateDocumentSummary } from '$lib/server/ai';

export async function load({params}) {
	const workItemId = params.id
	return {
		workItemId: workItemId,
	}
}

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData()
		const workItemId =+(data.get('workItemId') as string)
		const content = data.get('content') as string
		const summary = await generateDocumentSummary(content)
		const workItemDocument: WorkItemDocument = {
			workItemId,
			name: data.get('name') as string,
			type: data.get('type') as string,
			content,
			summary
		}
		await addWorkItemDocument(workItemDocument)
		redirect(303, `/work-items/${workItemId}`)
	}
}