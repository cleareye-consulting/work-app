<script lang="ts">
	import ContentHeader from '../../components/ContentHeader.svelte';
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

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

	function handleDrillDown(elementId: number) {
		const params = new SvelteURLSearchParams(window.location.search);
		params.set('parentId', elementId.toString());
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`?${params}`);
	}

	function clearParentFilter() {
		const params = new SvelteURLSearchParams(window.location.search);
		params.delete('parentId');
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`?${params}`);
	}
</script>

<ContentHeader pageTitle="Product Elements"/>

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

		{#if data.currentParentId}
			<button
				onclick={clearParentFilter}
				class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
			>
				← Back to Top Level
			</button>
		{/if}
	</div>

	<table class="w-full border-collapse table-fixed border border-gray-300">
		<thead>
		<tr class="border-b">
			<th class="text-left p-2">Name</th>
			<th class="text-left p-2">Client</th>
		</tr>
		</thead>
		<tbody>
		{#each data.productElements as element, i (i)}
			<tr
				class="border-b hover:bg-gray-50 cursor-pointer"
				onclick={() => handleDrillDown(element.id)}
			>
				<td class="p-2">{element.name}</td>
				<td class="p-2">{element.clientName}</td>
			</tr>
		{/each}
		</tbody>
	</table>
</div>