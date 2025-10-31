<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import A from '../../../components/A.svelte';
	import Select from '../../../components/Select.svelte';
	import Button from '../../../components/Button.svelte';
	import Table from '../../../components/Table.svelte';
	import TH from '../../../components/TH.svelte';
	import TD from '../../../components/TD.svelte';
	const { data } = $props();
</script>

<ContentHeader>{data?.workItem?.type}: {data.workItem?.name}</ContentHeader>

<form method="post">
	<input type="hidden" name="id" value={data.workItem?.id}/>
	<input type="hidden" name="clientId" value={data.workItem?.clientId}/>
	<input type="hidden" name="parentId" value={data.workItem?.parentId}/>
	<input type="hidden" name="type" value={data.workItem?.type}/>
	<input type="hidden" name="name" value={data.workItem?.name}/>
	<div>
		<Select name="productElementIds" label="Product Elements" multiple disabled>
			{#each data.clientProductElements as clientProductElement (clientProductElement.id)}
				<option
					value={clientProductElement.id}
					selected={data.workItemProductElements.some(wipe => wipe.id === clientProductElement.id)}>
					{clientProductElement.label}</option>
			{/each}
		</Select>
	</div>
	<div>
		<Select name="status" label="Status">
			{#each data.workItemStatuses as workItemStatus (workItemStatus)}
				<option value={workItemStatus} selected={data.workItem?.status === workItemStatus}>{workItemStatus}</option>
			{/each}
		</Select>
	</div>
	<div>
		<Button>Update</Button>
	</div>
</form>
<hr class="my-4"/>
<h3 class="text-2xl">Children</h3>
{#if data.workItem?.children?.length !== 0}
<Table>
	<thead>
		<tr>
			<TH>Name</TH>
			<TH>Type</TH>
			<TH>Status</TH>
		</tr>
	</thead>
	<tbody>
	{#each (data.workItem?.children ?? []) as child (child.id)}
		<tr>
			<TD><A href={`/work-items/${child.id}`}>{child.name}</A></TD>
			<TD>{child.type}</TD>
			<TD>{child.status}</TD>
		</tr>
	{/each}
	</tbody>
</Table>
{/if}
<div class="flex items-center gap-2 mt-4">
	<A href={`/work-items/new?parentId=${data.workItem?.id}&clientId=${data.workItem?.clientId}`}>New Child</A>
</div>
<hr class="my-4" />
<h3 class="text-2xl">Documents</h3>
{#each (data.workItem?.documents ?? []) as document (document.id)}
	<A href={`/work-items/${data.workItem?.id}/documents/${document.id}`}>{document.name}</A>
{/each}
<div class="flex items-center gap-2 mt-4">
	<A href={`/work-items/${data.workItem?.id}/documents/new`}>New Document</A>
</div>
