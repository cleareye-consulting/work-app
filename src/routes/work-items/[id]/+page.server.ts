import { env } from '$env/dynamic/private';
import { getChildWorkItems, getEventsForRange, getWorkItemById, getWorkItemTreesForClient, updateWorkItem } from '$lib/server/repositories/workItemRepository';
import { getActiveStatuses, workItemStatuses, workItemTypes } from '$lib/server/utils';
import { fail, redirect } from '@sveltejs/kit';
import { getClientName } from '$lib/server/repositories/clientRepository.js';
import {
	getTimeEntriesByWorkItem,
	getTimeEntriesOverlappingClientRange,
	getTimeTrackingStatus,
	startTracking,
	stopTracking
} from '$lib/server/repositories/timeRepository';
import { getRecentCalendarMonths, REPORT_TIME_ZONE } from '$lib/server/reportingPeriods';
import type { WorkItem, WorkItemChangeEvent } from '../../../types';

type HoursByMonth = Record<string, number>;
interface HierarchyJsonNode {
	totalHoursByMonth: HoursByMonth;
	children: HierarchyJsonNode[];
	[key: string]: unknown;
}

function nonZeroHoursByMonth(hoursByMonth: HoursByMonth): HoursByMonth {
	return Object.fromEntries(Object.entries(hoursByMonth).filter(([, hours]) => hours > 0));
}

function buildHierarchyJson(
	workItem: WorkItem,
	eventsByWorkItemId: Map<number, WorkItemChangeEvent[]>,
	directHoursByWorkItemId: Map<number, HoursByMonth>,
	monthKeys: string[]
): HierarchyJsonNode {
	const children = (workItem.children ?? []).map((child) =>
		buildHierarchyJson(child, eventsByWorkItemId, directHoursByWorkItemId, monthKeys)
	);
	const directHoursByMonth = directHoursByWorkItemId.get(workItem.id!) ?? Object.fromEntries(monthKeys.map((key) => [key, 0]));
	const totalHoursByMonth = Object.fromEntries(
		monthKeys.map((key) => [
			key,
			Math.round(
				(directHoursByMonth[key] + children.reduce((total, child) => total + ((child.totalHoursByMonth as HoursByMonth)[key] ?? 0), 0)) * 100
			) / 100
		])
	);

	return {
		id: workItem.id,
		name: workItem.name,
		type: workItem.type,
		status: workItem.status,
		description: workItem.description,
		customFields: workItem.customFields,
		documents: workItem.documents ?? [],
		changes: eventsByWorkItemId.get(workItem.id!) ?? [],
		directHoursByMonth: nonZeroHoursByMonth(directHoursByMonth),
		totalHoursByMonth: nonZeroHoursByMonth(totalHoursByMonth),
		children
	};
}

export async function load({ params }) {
	const id = params.id;
	const workItem = await getWorkItemById(+id);
	const activeStatuses = getActiveStatuses();
	const children = await getChildWorkItems(workItem, activeStatuses)
	const timeTrackingStatus = await getTimeTrackingStatus();
	const timeEntries = await getTimeEntriesByWorkItem(+id);
	return {
		workItem: {
			...workItem,
			documents: workItem.documents,
			children
		},
		timeTrackingStatus,
		timeEntries,
		workItemStatuses: workItemStatuses,
		workItemTypes: workItemTypes,
		featureFlags: {
			reparentWorkItems: env.FF_REPARENT_WORK_ITEMS === 'true',
			retypeWorkItems: env.FF_RETYPE_WORK_ITEMS === 'true'
		}
	};
}
export const actions = {
	update: async ({ request }) => {
		const formData = await request.formData();
		const rawData = Object.fromEntries(formData.entries());
		const customFields: Record<string, string | number | boolean | null> = {};
		const clientName = await getClientName(+rawData.clientId);
		const workItemUpdate = {
			id: +rawData.id,
			name: rawData.name as string,
			description: rawData.description as string,
			type: rawData.type as string,
			status: rawData.status as string,
			clientId: +rawData.clientId,
			clientName,
			parentId: rawData.parentId ? +rawData.parentId : undefined,
			customFields
		};

		for (const [key, value] of Object.entries(rawData)) {
			if (key.startsWith('cf_')) {
				const actualKey = key.replace('cf_', '');
				workItemUpdate.customFields[actualKey] = value as string | number | boolean | null;
			}
		}

		await updateWorkItem(workItemUpdate);
		return { success: true };
	},
	startTracking: async ({ request }) => {
		const formData = await request.formData();
		const workItemId = +(formData.get('id') as string);
		const clientId = +(formData.get('clientId') as string);
		await startTracking(workItemId, clientId);
		return { success: true };
	},
	stopTracking: async ({ request }) => {
		const formData = await request.formData();
		const workItemId = +(formData.get('id') as string);
		const timeEntryId = +(formData.get('timeEntryId') as string);
		await stopTracking(timeEntryId, workItemId);
		return { success: true };
	},
	viewHierarchyJson: async ({ params }) => {
		const workItem = await getWorkItemById(+params.id);
		if (workItem.parentId) return fail(400, { error: 'Hierarchy JSON is available only for top-level work items.' });

		const now = new Date();
		const months = getRecentCalendarMonths(12, now);
		const [roots, events, timeEntries] = await Promise.all([
			getWorkItemTreesForClient(workItem.clientId),
			getEventsForRange(workItem.clientId, new Date(0), now),
			getTimeEntriesOverlappingClientRange(workItem.clientId, months[0].start, now)
		]);
		const root = roots.find((item) => item.id === workItem.id);
		if (!root) return fail(404, { error: 'Work item hierarchy not found.' });

		const eventsByWorkItemId = new Map<number, WorkItemChangeEvent[]>();
		for (const event of events) {
			if (event.summaryOfChanges.startsWith('Document updated:')) continue;
			eventsByWorkItemId.set(event.workItemId, [...(eventsByWorkItemId.get(event.workItemId) ?? []), event]);
		}

		const monthKeys = months.map((month) => month.key);
		const directHoursByWorkItemId = new Map<number, HoursByMonth>();
		for (const entry of timeEntries) {
			const spanStart = new Date(entry.startTime).getTime();
			const spanEnd = new Date(entry.endTime ?? now.toISOString()).getTime();
			const hours = directHoursByWorkItemId.get(entry.workItemId) ?? Object.fromEntries(monthKeys.map((key) => [key, 0]));
			for (const month of months) {
				const overlapMs = Math.max(0, Math.min(spanEnd, month.end.getTime(), now.getTime()) - Math.max(spanStart, month.start.getTime()));
				if (overlapMs > 0) hours[month.key] += overlapMs / 3_600_000;
			}
			directHoursByWorkItemId.set(entry.workItemId, hours);
		}
		for (const hours of directHoursByWorkItemId.values()) {
			for (const month of monthKeys) hours[month] = Math.round(hours[month] * 100) / 100;
		}

		return {
			hierarchyJson: JSON.stringify(
				{
					timeZone: REPORT_TIME_ZONE,
					monthRange: { start: monthKeys[0], end: monthKeys.at(-1) },
					hierarchy: buildHierarchyJson(root, eventsByWorkItemId, directHoursByWorkItemId, monthKeys)
				},
				null,
				2
			)
		};
	}
};
