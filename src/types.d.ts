export interface Client {
	id?: number;
	name: string;
	isActive: boolean;
	documents?: ClientDocument[];
}

export interface ProductElement {
	id?: number;
	clientId: number;
	clientName: string;
	name: string;
	parentId?: number;
	parentName?: string;
	documents?: ProductElementDocument[];
	children?: ProductElement[];
}
interface BugFields {
	type: 'BUG';
	severity: 'LOW' | 'HIGH' | 'CRITICAL';
	reproSteps: string;
}

interface StoryFields {
	type: 'STORY';
	points: number;
	acceptanceCriteria: string;
}

export type WorkItemType = 'BUG' | 'STORY' | 'PROJECT' | 'TASK' | 'EPIC' | 'ISSUE' | 'NFR';

export interface BaseWorkItem {
	id?: number;
	name: string;
	status: string;
	description?: string;
	clientId: number;
	clientName: string;
	parentId?: number;
	parentName?: string;
	productElementIds?: number[];
	documents?: WorkItemDocument[];
	children?: WorkItem[];
}

export type WorkItem = BaseWorkItem & (BugFields | StoryFields | { type: WorkItemType});

export interface Document {
	id?: number;
	name: string;
	type: string;
	content: string;
}

export interface ClientDocument extends Document {
	clientId: number;
}

export interface ProductElementDocument extends Document {
	productElementId: number;
}

export interface WorkItemDocument extends Document {
	workItemId: number;
	summary?: string;
}
