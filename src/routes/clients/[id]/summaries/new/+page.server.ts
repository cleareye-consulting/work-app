import { getClientById } from '$lib/server/repositories/clientRepository';
import {
	getEventsForRange,
	getWorkItemTreesForClient
} from '$lib/server/repositories/workItemRepository';
import { getTimeEntriesOverlappingClientRange } from '$lib/server/repositories/timeRepository';
import { generateClientSummary, type ClientSummaryWorkItemInput } from '$lib/server/ai';
import { getActiveStatuses } from '$lib/server/utils';
import type { WorkItem, WorkItemChangeEvent } from '../../../../../types';
import { fail } from '@sveltejs/kit';

const REPORT_TIME_ZONE = process.env.REPORT_TIME_ZONE || 'America/New_York';
const PERIODS = ['month-to-date', 'last-calendar-month', 'week-to-date', 'last-week'] as const;
type Period = (typeof PERIODS)[number];

function zonedParts(date: Date) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: REPORT_TIME_ZONE,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		weekday: 'short'
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
	return { year: +value('year'), month: +value('month'), day: +value('day'), weekday: value('weekday') };
}

function timeZoneOffset(date: Date) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: REPORT_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) => +parts.find((part) => part.type === type)!.value;
	return Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second')) - date.getTime();
}

function zonedMidnight(year: number, month: number, day: number) {
	const localMidnight = Date.UTC(year, month - 1, day);
	let result = new Date(localMidnight - timeZoneOffset(new Date(localMidnight)));
	result = new Date(localMidnight - timeZoneOffset(result));
	return result;
}

function dateForLocalDay(year: number, month: number, day: number) {
	const date = new Date(Date.UTC(year, month - 1, day));
	return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function formatPeriodLabel(description: string, start: Date, end: Date, endIsExclusive: boolean) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: REPORT_TIME_ZONE,
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
	const displayedEnd = endIsExclusive ? new Date(end.getTime() - 1) : end;
	return `${description} (${formatter.format(start)}–${formatter.format(displayedEnd)})`;
}

function getPeriodRange(period: Period, now = new Date()) {
	const local = zonedParts(now);
	const mondayOffset = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[local.weekday] ?? 0;
	const monday = dateForLocalDay(local.year, local.month, local.day - mondayOffset);
	const monthStart = zonedMidnight(local.year, local.month, 1);

	switch (period) {
		case 'last-calendar-month': {
			const lastMonth = dateForLocalDay(local.year, local.month - 1, 1);
			return { start: zonedMidnight(lastMonth.year, lastMonth.month, 1), end: monthStart, description: 'last calendar month', endIsExclusive: true };
		}
		case 'week-to-date':
			return { start: zonedMidnight(monday.year, monday.month, monday.day), end: now, description: 'this week so far', endIsExclusive: false };
		case 'last-week': {
			const lastMonday = dateForLocalDay(monday.year, monday.month, monday.day - 7);
			return {
				start: zonedMidnight(lastMonday.year, lastMonday.month, lastMonday.day),
				end: zonedMidnight(monday.year, monday.month, monday.day),
				description: 'last week',
				endIsExclusive: true
			};
		}
		case 'month-to-date':
			return { start: monthStart, end: now, description: 'this month to date', endIsExclusive: false };
	}
}

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
	return { client: await getClientById(+params.id), timeZone: REPORT_TIME_ZONE };
}

export const actions = {
	generate: async ({ request, params }) => {
		const formData = await request.formData();
		const period = formData.get('period') as Period;
		if (!PERIODS.includes(period)) return fail(400, { error: 'Choose a valid reporting period.' });

		const clientId = +params.id;
		const range = getPeriodRange(period);
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
