<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import Input from '../../../components/Input.svelte';
	import Button from '../../../components/Button.svelte';
	import Select from '../../../components/Select.svelte';
	const { data } = $props();
</script>

<ContentHeader>New Product Element</ContentHeader>

<form method="POST">
	<input type="hidden" name="parentId" value={data.parentId} />
	<input type="hidden" name="parentName" value={data.parentName} />
	<div>
		<Input name="parentNameDisabled" readonly value={data.parentName}>Parent</Input>
	</div>
	{#if data.parentId}
		<input type="hidden" name="clientId" value={data.clientId} />
	{:else}
		<div>
			<Select name="clientId" label="Client" required>
				<option value="">Select Client</option>
				{#each data.clients as client (client.id)}
					<option value={client.id} selected={client.id === data.clientId}>{client.name}</option>
				{/each}
			</Select>
		</div>
	{/if}
	<div>
		<Input name="name" required>Name</Input>
	</div>
	<div>
		<Button>Create</Button>
	</div>
</form>
