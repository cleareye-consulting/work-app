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
	parentProductElementId?: number;
	parentProductElementName?: string;
	documents?: ProductElementDocument[];
	children?: ProductElement[];
}

export interface WorkItem {
	id?: number;
	name: string;
	workItemTypeId: number;
	workItemTypeName?: string;
	clientId: number;
	clientName?: string;
	parentId?: number;
	parentName?: string;
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
}

export interface WorkItemType {
	id?: number;
	name: string;
}