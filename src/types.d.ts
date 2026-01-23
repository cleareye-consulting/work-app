export interface Client {
	id?: number;
	name: string;
	isActive: boolean;
	documents?: ClientDocument[];
}

export interface WorkItem {
	id?: number;
	name: string;
	type: string;
	status: string;
	description?: string;
	clientId: number;
	clientName: string;
	parentId?: number;
	parentName?: string;
	customFields: Record<string, unknown>;
	documents?: WorkItemDocument[];
	children?: WorkItem[];
}

export interface Document {
	id?: number;
	name: string;
	type: string;
	content: string;
}

export interface ClientDocument extends Document {
	clientId: number;
}

export interface WorkItemDocument extends Document {
	workItemId: number;
	summary?: string;
}
