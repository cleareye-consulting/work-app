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