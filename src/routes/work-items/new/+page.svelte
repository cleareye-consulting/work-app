<script lang="ts">
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import Input from '../../../components/Input.svelte';
	import Button from '../../../components/Button.svelte';
	import Select from '../../../components/Select.svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import TextArea from '../../../components/TextArea.svelte';
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
	function camelCaseToTitleCaseWithSpaces(input: string) {
		const step1 = input.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
		return step1.charAt(0).toUpperCase() + step1.slice(1);
	}
	let selectedType = $state('')
	function handleTypeChange(e: Event) {
		selectedType = (e.target as HTMLSelectElement).value;
	}
</script>

<ContentHeader>New Work Item</ContentHeader>

<form method="POST">
	<input type="hidden" name="parentId" value={data.parentId} />
	<div>
		<Input name="parentName" readonly value={data.parentName}>Parent</Input>
	</div>
	{#if !data.parentId}
	<div>
		<Select name="clientId" label="Client" onchange={handleClientChange}>
			<option value="">Select Client</option>
			{#each data.clients as client (client.id)}
				<option value={client.id} selected={client.id === data.clientId}>{client.name}</option>
			{/each}
		</Select>
	</div>
	{:else}
		<input type="hidden" name="clientId" value={data.clientId} />
	{/if}
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
	<div>
		<Select name="type" label="Work Item Type" required onchange={handleTypeChange}>
			<option value="">Select Work Item Type</option>
			{#each data.workItemTypeOptions as workItemType (workItemType)}
				<option value={workItemType} selected={workItemType === selectedType}>{workItemType}</option>
			{/each}
		</Select>
	</div>
	<div>
		<Input name="name" required>Name</Input>
	</div>
	<div>
		<TextArea name="description">Description</TextArea>
	</div>
		{#each (selectedType ? data.workItemTypes[selectedType]?.customFields : []) as field (field.name)}
			<div>
				{#if field.values}
					<Select name={`cf_${field.name}`} label={camelCaseToTitleCaseWithSpaces(field.name)}>
						<option value=""></option>
						{#each field.values as value (value)}
							<option value={value}>{value}</option>
						{/each}
					</Select>
				{:else if field.multiline}
					<TextArea name={`cf_${field.name}`}>{camelCaseToTitleCaseWithSpaces(field.name)} </TextArea>
				{:else}
					<Input type={field.type} name={`cf_${field.name}`}>
						{camelCaseToTitleCaseWithSpaces(field.name)}
					</Input>
				{/if}
			</div>
		{/each}
	</div>
	<div>
		<Button>Create</Button>
	</div>
</form>
