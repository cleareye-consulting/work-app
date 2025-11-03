<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import A from '../../../components/A.svelte';
	const { data } = $props();
</script>

<ContentHeader>Product Element: {data.productElement?.name}</ContentHeader>

<h3 class="text-2xl">Components</h3>
{#each (data.productElement?.children ?? []) as child (child.id)}
	<div class="flex items-center gap-2">
		<A href={`/product-elements/${child.id}`}>{child.name}</A>
	</div>
{/each}
<div class="flex items-center gap-2 mt-4">
	<A href={`/product-elements/new?parentId=${data.productElement.id}&clientId=${data.productElement.clientId}`}>New Component</A>
</div>
<hr class="my-4" />
<h3 class="text-2xl">Documents</h3>
{#each (data.productElement?.documents ?? []) as document (document.id)}
	<A href={`/product-elements/${data.productElement.id}/documents/${document.id}`}>{document.name}</A>
{/each}
<div class="flex items-center gap-2 mt-4">
	<A href={`/product-elements/${data.productElement.id}/documents/new`}>New Document</A>
</div>
