<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import Input from '../../../components/Input.svelte';
	import Button from '../../../components/Button.svelte';
	import Select from '../../../components/Select.svelte';
	const { data } = $props();
</script>

<ContentHeader>New Work Item</ContentHeader>

<form method="POST">
	<input type="hidden" name="parentId" value={data.parentId}/>
	<div>
		<Input name="parentName" readonly value={data.parentName}>Parent</Input>
	</div>
	<div>
		<Select name="clientId" label="Client">
			<option value="">Select Client</option>
			{#each data.clients as client (client.id)}
				<option value={client.id} selected={client.id === data.clientId}>{client.name}</option>
			{/each}
		</Select>
	</div>
	<div>
		<Select name="workItemTypeId" label="Work Item Type">
			<option value="">Select Work Item Type</option>
			{#each data.workItemTypes as workItemType (workItemType.id)}
				<option value={workItemType.id}>{workItemType.name}</option>
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