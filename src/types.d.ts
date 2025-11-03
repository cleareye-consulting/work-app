export interface Client {
	id?: number;
	name: string;
	isActive: boolean;
	documents?: ClientDocument[];
}

export interface ProductElement {
	id?: number;
	clientId: number;
	clientName?: string;
	name: string;
	parentId?: number;
	parentName?: string;
	documents?: ProductElementDocument[];
	children?: ProductElement[];
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
	productElementIds?: number[];
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

export interface ProductElementDocument extends Document {
	productElementId: number;
}

export interface WorkItemDocument extends Document {
	workItemId: number;
	summary?: string;
}