<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import SubmitButton from '../../../components/SubmitButton.svelte';
	import TextInput from '../../../components/TextInput.svelte';
</script>

<ContentHeader pageTitle="New Client" />

<form method="POST">
	<div>
		<TextInput id="name" name="name" label="Name"/>
	</div>
	<div>
		<SubmitButton>Create</SubmitButton>
	</div>
</form>