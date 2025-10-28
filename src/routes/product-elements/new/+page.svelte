<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import Input from '../../../components/Input.svelte';
	import Button from '../../../components/Button.svelte';
	import Select from '../../../components/Select.svelte';
	const { data } = $props();
</script>

<ContentHeader pageTitle="New Product Element" />

<form method="POST">
	<div>
		<Input name="parentProductElementName" readonly value={data.parentName}>Parent</Input>
	</div>
	<div>
		<Select name="client" label="Client" disabled={data.clientId !== null}>
			<option value="">Select Client</option>
			{#each data.clients as client (client.id)}
				<option value={client.id} selected={client.id === data.clientId}  >{client.name}</option>
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