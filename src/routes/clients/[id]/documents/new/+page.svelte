<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import TextInput from '../../../../../components/TextInput.svelte';
	import SubmitButton from '../../../../../components/SubmitButton.svelte';
	let name = $state('')
	let {data} = $props() as {data: {clientId: string}}
	let content = $state('')
</script>

<ContentHeader pageTitle="New Document" />

<form method="POST">
	<input type="hidden" name="clientId" value={data.clientId} />
<div>
	<TextInput id="name" name="name" label="Name" value={name} />
</div>
<div>
	<TextInput id="type" name="type" label="Type" value="text/markdown"/>
</div>
<div>
	<SubmitButton>Add</SubmitButton>
</div>
<MarkdownEditor bind:value={content}></MarkdownEditor>
</form>