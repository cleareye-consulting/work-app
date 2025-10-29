<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import Button from '../../../../../components/Button.svelte';
	import type { ProductElementDocument } from '../../../../../types';
	import Input from '../../../../../components/Input.svelte';
	let {data}: {data: {document: ProductElementDocument}} = $props()
	let content = $state(data.document.content)
</script>

<ContentHeader pageTitle="Edit Document" />

<form method="POST">
	<input type="hidden" name="id" value="{data.document.id}"/>
	<input type="hidden" name="productElementId" value={data.document.productElementId} />
	<input type="hidden" name="type" value="text/markdown" />
<div>
	<Input name="name" value={data.document.name}>Name</Input>
</div>
<div>
	<Button>Update</Button>
</div>
<MarkdownEditor bind:value={content} initialMode="preview" ></MarkdownEditor>
</form>