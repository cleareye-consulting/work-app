import type { ProductElement } from '../../types';

export function flatMapClientProductElements(clientProductElements: ProductElement[]) {
	const result: { id: number; label: string }[] = [];
	for (const productElement of clientProductElements) {
		const prefixParts: string[] = [];
		let parentId = productElement.parentProductElementId;
		while (parentId) {
			// This could be optimized by creating a map of parentProductElementId to ProductElement
			const parent = clientProductElements.find((pe) => pe.id === parentId);
			prefixParts.push(parent!.name);
			parentId = parent!.parentProductElementId;
		}
		result.push({
			id: productElement.id!,
			label:
				prefixParts.length === 0
					? productElement.name
					: `${prefixParts.reverse().join(' > ')} > ${productElement.name}`
		});
	}
	return result;
}

export const workItemTypes = ['PROJECT', 'FEATURE', 'EPIC', 'STORY', 'TASK', 'NFR', 'BUG', 'ISSUE', 'TEST_RESULT'];
export const workItemStatuses = ['NEW', 'PLANNING', 'IN_PROGRESS', 'BLOCKED', 'PENDING_REVIEW', 'TESTING', 'COMPLETED', 'CANCELED', 'ARCHIVED'];

