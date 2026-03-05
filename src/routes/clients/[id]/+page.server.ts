import { addClientSummary, getClientById, updateClient } from '$lib/server/repositories/clientRepository';
import type { Client } from '../../../types';
import { redirect } from '@sveltejs/kit';
import { getTimeEntriesByClientAndRange } from '$lib/server/repositories/timeRepository';
import { getWorkItemById } from '$lib/server/repositories/workItemRepository';

export async function load({ params, url }) {
	const id = params.id;
	const client = await getClientById(+id);

	const period = url.searchParams.get('period') || 'this-month';
	const now = new Date();
	const billingStartDay = client.billingStartDayOfMonth || 1;
	let startOfMonth: Date;
	let endOfMonth: Date;

	if (period === 'last-month') {
		if (now.getDate() >= billingStartDay) {
			// This month started on billingStartDay of this month.
			// Last month started on billingStartDay of last month.
			startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, billingStartDay);
			endOfMonth = new Date(now.getFullYear(), now.getMonth(), billingStartDay - 1, 23, 59, 59, 999);
		} else {
			// This month started on billingStartDay of last month.
			// Last month started on billingStartDay of 2 months ago.
			startOfMonth = new Date(now.getFullYear(), now.getMonth() - 2, billingStartDay);
			endOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, billingStartDay - 1, 23, 59, 59, 999);
		}
	} else {
		if (now.getDate() >= billingStartDay) {
			// This month started on billingStartDay of this month.
			startOfMonth = new Date(now.getFullYear(), now.getMonth(), billingStartDay);
			endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, billingStartDay - 1, 23, 59, 59, 999);
		} else {
			// This month started on billingStartDay of last month.
			startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, billingStartDay);
			endOfMonth = new Date(now.getFullYear(), now.getMonth(), billingStartDay - 1, 23, 59, 59, 999);
		}
	}

	const timeEntries = await getTimeEntriesByClientAndRange(
		+id,
		startOfMonth.toISOString(),
		endOfMonth.toISOString()
	);

	const timeByWorkItem: Record<number, number> = {};
	for (const entry of timeEntries) {
		if (entry.startTime && entry.endTime) {
			const start = new Date(entry.startTime).getTime();
			const end = new Date(entry.endTime).getTime();
			const durationHours = (end - start) / (1000 * 60 * 60);

			timeByWorkItem[entry.workItemId] = (timeByWorkItem[entry.workItemId] || 0) + durationHours;
		}
	}

	interface TimeSummaryNode {
		workItemId: number;
		workItemName: string;
		directHours: number;
		totalHours: number;
		parentId?: number;
		children: TimeSummaryNode[];
	}

	const nodes: Map<number, TimeSummaryNode> = new Map();

	// Function to get or create a node and its ancestors
	async function ensureNode(workItemId: number): Promise<TimeSummaryNode | null> {
		if (nodes.has(workItemId)) return nodes.get(workItemId)!;

		try {
			const wi = await getWorkItemById(workItemId);
			const node: TimeSummaryNode = {
				workItemId,
				workItemName: wi.name,
				directHours: timeByWorkItem[workItemId] || 0,
				totalHours: 0,
				parentId: wi.parentId && wi.parentId !== 0 ? wi.parentId : undefined,
				children: []
			};
			nodes.set(workItemId, node);

			if (node.parentId) {
				await ensureNode(node.parentId);
			}
			return node;
		} catch (e) {
			console.error(`Failed to fetch work item ${workItemId}:`, e);
			return null;
		}
	}

	// 1. Build all necessary nodes
	for (const workItemId of Object.keys(timeByWorkItem)) {
		await ensureNode(+workItemId);
	}

	// 2. Link children to parents
	const rootNodes: TimeSummaryNode[] = [];
	for (const node of nodes.values()) {
		if (node.parentId && nodes.has(node.parentId)) {
			nodes.get(node.parentId)!.children.push(node);
		} else {
			rootNodes.push(node);
		}
	}

	// 3. Calculate total hours recursively (bottom-up)
	function calculateTotalHours(node: TimeSummaryNode): number {
		let total = node.directHours;
		for (const child of node.children) {
			total += calculateTotalHours(child);
		}
		node.totalHours = Math.round(total * 100) / 100;
		return total;
	}

	for (const root of rootNodes) {
		calculateTotalHours(root);
	}

	// 4. Flatten for easier rendering or keep as tree
	// The user asked for a specific format which looks like a tree.
	// Let's provide the root nodes.
	
	const monthlyTimeSummary = rootNodes
		.filter(node => node.totalHours > 0)
		.sort((a, b) => a.workItemId - b.workItemId);

	return {
		client,
		monthlyTimeSummary,
		period,
		startDate: startOfMonth.toISOString(),
		endDate: endOfMonth.toISOString()
	};
}

export const actions = {
	updateClient: async ({ request }) => {
		const data = await request.formData();
		const client: Client = {
			id: +(data.get('id') as string),
			name: data.get('name') as string,
			isActive: data.has('isActive'),
			billingStartDayOfMonth: data.get('billingStartDayOfMonth') ? +(data.get('billingStartDayOfMonth') as string) : undefined
		};
		await updateClient(client);
		redirect(303, '/clients');
	}
};