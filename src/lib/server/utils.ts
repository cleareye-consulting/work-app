export const workItemTypes = ['PROJECT', 'FEATURE', 'EPIC', 'STORY', 'TASK', 'NFR', 'BUG', 'ISSUE'];
export const workItemStatuses = ['NEW', 'PLANNING', 'IN_PROGRESS', 'BLOCKED', 'PENDING_REVIEW', 'TESTING', 'COMPLETED', 'CANCELED', 'ARCHIVED'];

export const getActiveStatuses = () => workItemStatuses.filter(status => status !== 'ARCHIVED' && status !== 'CANCELED');

