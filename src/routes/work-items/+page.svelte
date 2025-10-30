<script lang="ts">
	import ContentHeader from '../../components/ContentHeader.svelte';
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import Table from '../../components/Table.svelte';
	import TH from '../../components/TH.svelte';
	import TD from '../../components/TD.svelte';
	import A from '../../components/A.svelte';

	let { data } = $props();
	let { clients } = data;

	function handleClientChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const params = new SvelteURLSearchParams(window.location.search);
		if (target.value) {
			params.set('clientId', target.value);
		} else {
			params.delete('clientId');
		}
		// Clear parent filter when changing client
		params.delete('parentId');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`?${params}`);
	}
</script>

<ContentHeader>Work Items</ContentHeader>

<div class="my-4">
	<div class="mb-4 flex gap-4 items-center">
		<div>
		<label for="clientId" class="mr-2">Client:</label>
		<select
			id="clientFilter"
			onchange={handleClientChange}
			class="border rounded px-2 py-1"
		>
			<option value="">All Clients</option>
			{#each clients as client, i (i)}
				<option value={client.id} selected={client.id === data.currentClientId} >{client.name}</option>
			{/each}
		</select>
		</div>
	</div>

	<Table>
		<thead>
		<tr>
			<TH>Name</TH>
			<TH>Client</TH>
		</tr>
		</thead>
		<tbody>
		{#each data.workItems as element, i (i)}
			<tr class="border-b hover:bg-gray-50 cursor-pointer" >
				<TD><A href="/work-items/{element.id}">{element.name}</A></TD>
				<TD>{element.clientName}</TD>
			</tr>
		{/each}
		</tbody>
	</Table>
</div>
<hr/>
<A href={`/work-items/new?parentId=${data.currentParentId ?? ''}&clientId=${data.currentClientId ?? ''}`}>New Work Item</A>