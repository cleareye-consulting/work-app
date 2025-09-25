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
	parentProductElementId?: number;
	parentProductElementName?: string;
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