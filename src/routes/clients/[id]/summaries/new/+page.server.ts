import { getClientById } from '$lib/server/repositories/clientRepository';
import {
	getEventsForRange,
	getWorkItemTreesForClient
} from '$lib/server/repositories/workItemRepository';
import { getTimeEntriesOverlappingClientRange } from '$lib/server/repositories/timeRepository';
import { generateClientSummary, type ClientSummaryWorkItemInput } from '$lib/server/ai';
import { getActiveStatuses } from '$lib/server/utils';
import { formatPeriodLabel, getReportPeriodRange, reportPeriods, type ReportPeriod } from '$lib/server/reportingPeriods';
import type { WorkItem, WorkItemChangeEvent } from '../../../../../types';
import { fail } from '@sveltejs/kit';

function getRootIds(roots: WorkItem[]) {
	const rootIds = new Map<number, number>();
	function visit(item: WorkItem, rootId: number) {
		rootIds.set(item.id!, rootId);
		for (const child of item.children ?? []) visit(child, rootId);
	}
	for (const root of roots) visit(root, root.id!);
	return rootIds;
}

function buildSummaryTree(
	workItem: WorkItem,
	eventsByWorkItemId: Map<number, WorkItemChangeEvent[]>,
	hoursByWorkItemId: Map<number, number>
): ClientSummaryWorkItemInput {
	return {
		workItem,
		events: eventsByWorkItemId.get(workItem.id!) ?? [],
		directHours: hoursByWorkItemId.get(workItem.id!) ?? 0,
		children: (workItem.children ?? []).map((child) => buildSummaryTree(child, eventsByWorkItemId, hoursByWorkItemId))
	};
}

export async function load({ params }) {
	return { client: await getClientById(+params.id) };
}

export const actions = {
	generate: async ({ request, params }) => {
		const formData = await request.formData();
		const period = formData.get('period') as ReportPeriod;
		if (!reportPeriods.includes(period)) return fail(400, { error: 'Choose a valid reporting period.' });

		const clientId = +params.id;
		const range = getReportPeriodRange(period);
		const periodLabel = formatPeriodLabel(range.description, range.start, range.end, range.endIsExclusive);
		const [events, roots, timeEntries] = await Promise.all([
			getEventsForRange(clientId, range.start, range.end),
			getWorkItemTreesForClient(clientId),
			getTimeEntriesOverlappingClientRange(clientId, range.start, range.end)
		]);
		const eventsByWorkItemId = new Map<number, WorkItemChangeEvent[]>();
		for (const event of events) {
			eventsByWorkItemId.set(event.workItemId, [...(eventsByWorkItemId.get(event.workItemId) ?? []), event]);
		}

		const hoursByWorkItemId = new Map<number, number>();
		for (const entry of timeEntries) {
			const spanStart = new Date(entry.startTime).getTime();
			const spanEnd = new Date(entry.endTime ?? range.end.toISOString()).getTime();
			const overlapMs = Math.max(0, Math.min(spanEnd, range.end.getTime()) - Math.max(spanStart, range.start.getTime()));
			if (overlapMs > 0) {
				hoursByWorkItemId.set(entry.workItemId, (hoursByWorkItemId.get(entry.workItemId) ?? 0) + overlapMs / 3_600_000);
			}
		}

		const rootIds = getRootIds(roots);
		const activityRootIds = new Set(
			events.map((event) => rootIds.get(event.workItemId)).filter((id): id is number => id !== undefined)
		);
		const activityProjects = roots
			.filter((root) => activityRootIds.has(root.id!))
			.map((root) => buildSummaryTree(root, eventsByWorkItemId, hoursByWorkItemId));
		const noActivityProjectNames = roots
			.filter((root) => getActiveStatuses().includes(root.status) && !activityRootIds.has(root.id!))
			.map((root) => root.name);

		const generatedContent = await generateClientSummary({
			periodLabel,
			activityProjects,
			noActivityProjectNames
		});

		return { generatedContent, period, periodLabel };
	}
};
