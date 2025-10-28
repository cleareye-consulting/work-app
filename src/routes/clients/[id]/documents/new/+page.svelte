<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import Button from '../../../../../components/Button.svelte';
	import Input from '../../../../../components/Input.svelte';
	let name = $state('')
	let {data} = $props() as {data: {clientId: string}}
	let content = $state('')
</script>

<ContentHeader pageTitle="New Document" />

<form method="POST">
	<input type="hidden" name="clientId" value={data.clientId} />
	<input type="hidden" id="type" name="type" value="text/markdown"/>
<div>
	<Input name="name" value={name}>Name</Input>
</div>
<div>
	<Button>Add</Button>
</div>
<MarkdownEditor bind:value={content}></MarkdownEditor>
</form>