<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import Button from '../../../../../components/Button.svelte';
	import type { WorkItemDocument } from '../../../../../types';
	import Input from '../../../../../components/Input.svelte';
	let {data}: {data: {document: WorkItemDocument}} = $props()
	let content = $state(data.document.content)
</script>

<ContentHeader>Edit Document</ContentHeader>

<form method="POST">
	<input type="hidden" name="id" value="{data.document.id}"/>
	<input type="hidden" name="workItemId" value={data.document.workItemId} />
	<input type="hidden" name="type" value="text/markdown" />
<div>
	<Input name="name" value={data.document.name} required>Name</Input>
</div>
<div>
	<Button>Update</Button>
</div>
<MarkdownEditor bind:value={content} initialMode="preview" ></MarkdownEditor>
</form>