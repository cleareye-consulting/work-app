<script>
import ContentHeader from '../../../components/ContentHeader.svelte';
import TextInput from '../../../components/TextInput.svelte';
import Checkbox from '../../../components/Checkbox.svelte';
import SubmitButton from '../../../components/SubmitButton.svelte';
import A from '../../../components/A.svelte';
let {data} = $props()
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
<hr class="my-4" />
<h3 class="text-2xl">Product Elements</h3>
<hr class="my-4" />
<h3 class="text-2xl">Work Items</h3>
<hr class="my-4" />
<h3 class="text-2xl">Documents</h3>
{#each data.client.documents as document, index (document.id)}
	<div><A href="/clients/{data.client.id}/documents/{document.id}">{document.name}</A></div>
{/each}
<A href="/clients/{data.client.id}/documents/new">New Document</A>
