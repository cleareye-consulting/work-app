export const REPORT_TIME_ZONE = process.env.REPORT_TIME_ZONE || 'America/New_York';

export const reportPeriods = [
	'month-to-date',
	'last-calendar-month',
	'week-to-date',
	'last-week'
] as const;
export type ReportPeriod = (typeof reportPeriods)[number];

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

export function formatPeriodLabel(description: string, start: Date, end: Date, endIsExclusive: boolean) {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: REPORT_TIME_ZONE,
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
	const displayedEnd = endIsExclusive ? new Date(end.getTime() - 1) : end;
	return `${description} (${formatter.format(start)}–${formatter.format(displayedEnd)})`;
}

export function getReportPeriodRange(period: ReportPeriod, now = new Date()) {
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
			return { start: zonedMidnight(lastMonday.year, lastMonday.month, lastMonday.day), end: zonedMidnight(monday.year, monday.month, monday.day), description: 'last week', endIsExclusive: true };
		}
		case 'month-to-date':
			return { start: monthStart, end: now, description: 'this month to date', endIsExclusive: false };
	}
}

export function getRecentCalendarMonths(count: number, now = new Date()) {
	const local = zonedParts(now);
	return Array.from({ length: count }, (_, index) => {
		const month = dateForLocalDay(local.year, local.month - (count - 1 - index), 1);
		const nextMonth = dateForLocalDay(month.year, month.month + 1, 1);
		return {
			key: `${month.year}-${String(month.month).padStart(2, '0')}`,
			start: zonedMidnight(month.year, month.month, 1),
			end: zonedMidnight(nextMonth.year, nextMonth.month, 1)
		};
	});
}
