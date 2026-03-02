<script lang="ts">
import ContentHeader from '../../../components/ContentHeader.svelte';
import Checkbox from '../../../components/Checkbox.svelte';
import Button from '../../../components/Button.svelte';
import A from '../../../components/A.svelte';
import Input from '../../../components/Input.svelte';
import Table from '../../../components/Table.svelte';
import TH from '../../../components/TH.svelte';
import TD from '../../../components/TD.svelte';
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
<div class="flex items-baseline justify-between mb-4">
	<h3 class="text-2xl">
		{data.period === 'last-month' ? 'Last' : 'Current'} Month Time Summary
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
	<Table class="w-full">
		<thead>
			<tr>
				<TH class="w-1/2">Work Item</TH>
				<TH class="w-1/2">Hours</TH>
			</tr>
		</thead>
		<tbody>
			{#each data.monthlyTimeSummary as entry (entry.workItemId)}
				<tr>
					<TD><A href="/work-items/{entry.workItemId}">WI#{entry.workItemId}</A></TD>
					<TD>{entry.hours}</TD>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="text-gray-500 italic">No time entries for {data.period === 'last-month' ? 'last' : 'this'} month.</p>
{/if}

<div class="pb-12"></div>
