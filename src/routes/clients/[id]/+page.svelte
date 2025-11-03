<script lang="ts">
import ContentHeader from '../../../components/ContentHeader.svelte';
import Checkbox from '../../../components/Checkbox.svelte';
import Button from '../../../components/Button.svelte';
import A from '../../../components/A.svelte';
import Input from '../../../components/Input.svelte';
let {data} = $props()
</script>

<ContentHeader>Client: {data.client.name}</ContentHeader>

<form method="POST">
	<input type="hidden" id="id" name="id" value={data.client.id} />
	<div>
		<Input name="name" value={data.client.name}>Name</Input>
	</div>
	<div>
		<Checkbox id="isActive" name="isActive" checked={data.client.isActive}>Active</Checkbox>
	</div>
	<div>
		<Button>Update</Button>
	</div>
</form>
<hr class="my-4" />
<h3 class="text-2xl">Documents</h3>
{#each (data.client.documents ?? []) as document (document.id)}
	<div><A href="/clients/{data.client.id}/documents/{document.id}">{document.name}</A></div>
{/each}
<A href="/clients/{data.client.id}/documents/new">New Document</A>
