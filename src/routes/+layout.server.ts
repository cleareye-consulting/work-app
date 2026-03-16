import { getTimeTrackingStatus } from '$lib/server/repositories/timeRepository';
import { getWorkItemById } from '$lib/server/repositories/workItemRepository';

export const load = async ({ locals }) => {
	const session = await locals.auth();
	let activeWorkItem = null;

	if (session) {
		const status = await getTimeTrackingStatus();
		if (status.activeWorkItemId) {
			try {
				activeWorkItem = await getWorkItemById(status.activeWorkItemId);
			} catch (e) {
				console.error('Failed to fetch active work item', e);
			}
		}
	}

	return {
		session,
		activeWorkItem
	};
};
