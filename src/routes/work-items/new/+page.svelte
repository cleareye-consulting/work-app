<script lang="ts">
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import Input from '../../../components/Input.svelte';
	import Button from '../../../components/Button.svelte';
	import Select from '../../../components/Select.svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	const { data } = $props();
	function handleClientChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const params = new SvelteURLSearchParams(window.location.search);
		if (target.value) {
			params.set('clientId', target.value);
		} else {
			params.delete('clientId');
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`?${params}`);
	}
</script>

<ContentHeader>New Work Item</ContentHeader>

<form method="POST">
	<input type="hidden" name="parentId" value={data.parentId}/>
	<div>
		<Input name="parentName" readonly value={data.parentName}>Parent</Input>
	</div>
	<div>
		<Select name="clientId" label="Client" onchange={handleClientChange}>
			<option value="">Select Client</option>
			{#each data.clients as client (client.id)}
				<option value={client.id} selected={client.id === data.clientId}>{client.name}</option>
			{/each}
		</Select>
	</div>
	<div>
		<Select name="type" label="Work Item Type">
			<option value="">Select Work Item Type</option>
			{#each data.workItemTypes as workItemType (workItemType)}
				<option value={workItemType}>{workItemType}</option>
			{/each}
		</Select>
	</div>
	<div>
		<Select name="productElementIds" label="Product Elements" multiple>
			{#each data.clientProductElements as clientProductElement (clientProductElement.id)}
				<option value={clientProductElement.id}>{clientProductElement.label}</option>
				{/each}
		</Select>
	</div>
	<div>
		<Input name="name">Name</Input>
	</div>
	<div>
		<Button>Create</Button>
	</div>
</form>