<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import Button from '../../../components/Button.svelte';
	import Input from '../../../components/Input.svelte';
</script>

<ContentHeader>New Client</ContentHeader>

<form method="POST">
	<div>
		<Input name="name" required>Name</Input>
	</div>
	<div>
		<Button>Create</Button>
	</div>
</form>