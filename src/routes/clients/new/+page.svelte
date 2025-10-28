<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import Button from '../../../components/Button.svelte';
	import Input from '../../../components/Input.svelte';
</script>

<ContentHeader pageTitle="New Client" />

<form method="POST">
	<div>
		<Input name="name">Name</Input>
	</div>
	<div>
		<Button>Create</Button>
	</div>
</form>