<script>
import ContentHeader from '../../../components/ContentHeader.svelte';
import TextInput from '../../../components/TextInput.svelte';
import Checkbox from '../../../components/Checkbox.svelte';
import SubmitButton from '../../../components/SubmitButton.svelte';
export let data
</script>

<ContentHeader pageTitle="Client" />

<form method="POST">
	<input type="hidden" id="id" name="id" value={data.client.id} />
	<div>
		<TextInput id="name" name="name" label="Name" value={data.client.name} />
	</div>
	<div>
		<Checkbox id="isActive" name="isActive" label="Active" isChecked={data.client.isActive} />
	</div>
	<div>
		<SubmitButton>Update</SubmitButton>
	</div>
</form>