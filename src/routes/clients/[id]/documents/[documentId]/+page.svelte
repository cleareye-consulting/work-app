<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import TextInput from '../../../../../components/TextInput.svelte';
	import SubmitButton from '../../../../../components/SubmitButton.svelte';
	import type { ClientDocument } from '../../../../../types';
	let {data}: {data: {document: ClientDocument}} = $props()
	let content = $state(data.document.content)
</script>

<ContentHeader pageTitle="Edit Document" />

<form method="POST">
	<input type="hidden" name="id" value="{data.document.id}"/>
	<input type="hidden" name="clientId" value={data.document.clientId} />
<div>
	<TextInput id="name" name="name" label="Name" value={data.document.name} />
</div>
<div>
	<TextInput id="type" name="type" label="Type" value="text/markdown"/>
</div>
<div>
	<SubmitButton>Update</SubmitButton>
</div>
<MarkdownEditor bind:value={content}></MarkdownEditor>
</form>