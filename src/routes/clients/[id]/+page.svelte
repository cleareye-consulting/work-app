<script lang="ts">
import ContentHeader from '../../../components/ContentHeader.svelte';
import Checkbox from '../../../components/Checkbox.svelte';
import Button from '../../../components/Button.svelte';
import A from '../../../components/A.svelte';
import Input from '../../../components/Input.svelte';
import { onMount } from 'svelte';
let {data} = $props()

let form: HTMLFormElement;

onMount(() => {
	// Auto-submit form when radio buttons change
})

function handlePeriodChange() {
	form.submit();
}
</script>

<ContentHeader>Client: {data.client.name}</ContentHeader>

<form method="POST" action="?/updateClient">
	<input type="hidden" id="id" name="id" value={data.client.id} />
	<div>
		<Input name="name" value={data.client.name}>Name</Input>
	</div>
	<div>
		<Checkbox id="isActive" name="isActive" checked={data.client.isActive}>Active</Checkbox>
	</div>
	<div>
		<Button>Update</Button>
	</div>
</form>

<hr class="my-4" />
<h3 class="text-2xl mb-4">Documents</h3>
{#each data.client.documents ?? [] as document (document.id)}
	<div class="mb-2">
		<A href="/clients/{data.client.id}/documents/{document.id}">{document.name}</A>
	</div>
{/each}
<div class="mt-4">
	<A href="/clients/{data.client.id}/documents/new">New Document</A>
</div>

<hr class="my-4" />
<h3 class="text-2xl mb-4">Summaries</h3>
<div class="space-y-4">
 {#each data.client.summaries ?? [] as summary (summary.createdAt)}
	<div class="mb-2">
		<A href="/clients/{data.client.id}/summaries/{summary.createdAt}">
			{new Date(summary.createdAt).toLocaleDateString()} {new Date(summary.createdAt).toLocaleTimeString()}
		</A>
	</div>
{:else}
	<div class="text-gray-500 italic">No summaries yet.</div>
{/each}
</div>
<div class="mt-4">
	<A href="/clients/{data.client.id}/summaries/new">New Summary</A>
</div>

<hr class="my-4" />
<div class="max-w-4xl">
	<div class="flex items-baseline justify-between mb-4">
		<h3 class="text-2xl">
			Time Tracking
		</h3>
		<form bind:this={form} method="GET" class="flex gap-4 items-center">
			<label class="flex items-center gap-2 cursor-pointer">
				<input 
					type="radio" 
					name="period" 
					value="this-month" 
					checked={data.period !== 'last-month'} 
					onchange={handlePeriodChange}
				/>
				This Month
			</label>
			<label class="flex items-center gap-2 cursor-pointer">
				<input 
					type="radio" 
					name="period" 
					value="last-month" 
					checked={data.period === 'last-month'} 
					onchange={handlePeriodChange}
				/>
				Last Month
			</label>
		</form>
	</div>

	{#if data.monthlyTimeSummary.length > 0}
		<div class="bg-white border border-gray-300 rounded-lg overflow-hidden">
			<div class="grid grid-cols-4 bg-gray-50 border-b border-gray-300 font-bold py-2 px-4">
				<div class="col-span-3">Work Item</div>
				<div class="text-right">Hours</div>
			</div>
			<div class="divide-y divide-gray-200">
				{#each data.monthlyTimeSummary as node (node.workItemId)}
					{@render timeRow(node, 0)}
				{/each}
			</div>
		</div>
	{:else}
		<p class="text-gray-500 italic">No time entries for {data.period === 'last-month' ? 'last' : 'this'} month.</p>
	{/if}
</div>

{#snippet timeRow(node, depth)}
	<div class="grid grid-cols-4 py-2 px-4 hover:bg-gray-50 items-center">
		<div class="col-span-3 truncate" style="padding-left: {depth * 1.5}rem">
			<A href="/work-items/{node.workItemId}">{node.workItemName}</A>
		</div>
		<div class="text-right font-mono">{node.totalHours.toFixed(2)}</div>
	</div>
	{#each node.children.sort((a, b) => a.workItemId - b.workItemId) as child (child.workItemId)}
		{@render timeRow(child, depth + 1)}
	{/each}
{/snippet}

<div class="pb-12"></div>
