<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import A from '../../../components/A.svelte';
	const { data } = $props();
</script>

<ContentHeader>{data?.workItem?.workItemTypeName}: {data.workItem?.name}</ContentHeader>

<h3 class="text-2xl">Components</h3>
{#each (data.workItem?.children ?? []) as child (child.id)}
	<div class="flex items-center gap-2">
		<A href={`/work-items/${child.id}`}>{child.name}</A>
	</div>
{/each}
<div class="flex items-center gap-2">
	<A href={`/work-items/new?parentId=${data.workItem?.id}&clientId=${data.workItem?.clientId}`}>New Component</A>
</div>
<hr class="my-4" />
<h3 class="text-2xl">Documents</h3>
{#each (data.workItem?.documents ?? []) as document (document.id)}
	<A href={`/work-items/${data.workItem?.id}/documents/${document.id}`}>{document.name}</A>
{/each}
<div class="flex items-center gap-2">
	<A href={`/work-items/${data.workItem?.id}/documents/new`}>New Document</A>
</div>
