export const workItemStatuses = ['NEW', 'PLANNING', 'IN_PROGRESS', 'BLOCKED', 'PENDING_REVIEW', 'TESTING', 'COMPLETED', 'CANCELED', 'ARCHIVED'];

export const getActiveStatuses = () => workItemStatuses.filter(status => status !== 'ARCHIVED' && status !== 'CANCELED');

export interface workItemTypeInfo {
	customFields: {name: string, type: string, required?: boolean, values?: string[] | number[], multiline?: boolean}[];
	parentTypes: string[];
}

export interface workItemTypesList {
	[key: string]: workItemTypeInfo;
}

export const workItemTypes : workItemTypesList =  {
	PROJECT: {
		customFields: [],
		parentTypes: ['_CLIENT_', 'PROJECT'],
	},
	FEATURE: {
		customFields: [],
		parentTypes: ['PROJECT'],
	},
	EPIC: {
		customFields: [
			{name: 'rank', type: 'number', required: true}
		],
		parentTypes: ['FEATURE'],
	},
	STORY: {
		customFields: [
			{name: 'rank', type: 'number'},
			{name: 'points', type: 'number', values: [1, 2, 3, 5, 8, 13, 20]},
			{name: 'acceptanceCriteria', type: 'string'}
		],
		parentTypes: ['PROJECT', 'FEATURE', 'EPIC'],
	},
	TASK: {
		customFields: [],
		parentTypes: ['_CLIENT_', 'STORY', 'BUG'],
	},
	NFR: {
		customFields: [],
		parentTypes: ['PROJECT', 'FEATURE', 'EPIC'],
	},
	BUG: {
		customFields: [
			{name: 'severity', type: 'string', values: ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR']},
			{name: 'reproSteps', type: 'string', multiline: true}
		],
		parentTypes: ['STORY', 'PROJECT', 'FEATURE', 'EPIC'],
	},
	ISSUE: {
		customFields: [],
		parentTypes: ['_CLIENT_', 'PROJECT']
	}
};

