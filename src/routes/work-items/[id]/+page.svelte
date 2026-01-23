<script>
	import ContentHeader from '../../../components/ContentHeader.svelte';
	import A from '../../../components/A.svelte';
	import Select from '../../../components/Select.svelte';
	import Button from '../../../components/Button.svelte';
	import Table from '../../../components/Table.svelte';
	import TH from '../../../components/TH.svelte';
	import TD from '../../../components/TD.svelte';
	import TextArea from '../../../components/TextArea.svelte';
	const { data } = $props();
	const childItemsSorted = $derived(
		data.workItem.children?.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)) ?? []
	);
	const documentsSorted = $derived(
		data.workItem.documents?.sort((a, b) => (a.name < b.name ? 1 : -1)) ?? []
	);
</script>

<ContentHeader>{data?.workItem?.type} {data?.workItem?.id}: {data.workItem?.name}</ContentHeader>

<form method="post">
	<input type="hidden" name="id" value={data.workItem?.id} />
	<input type="hidden" name="clientId" value={data.workItem?.clientId} />
	<input type="hidden" name="parentId" value={data.workItem?.parentId} />
	<input type="hidden" name="type" value={data.workItem?.type} />
	<input type="hidden" name="name" value={data.workItem?.name} />
	<div>
		<Select name="status" label="Status">
			{#each data.workItemStatuses as workItemStatus (workItemStatus)}
				<option value={workItemStatus} selected={data.workItem?.status === workItemStatus}
					>{workItemStatus}</option
				>
			{/each}
		</Select>
	</div>
	<div>
		<TextArea name="description" value={data.workItem.description}>Description</TextArea>
	</div>
	<div>
		<Button>Update</Button>
		<A
			class="ms-3"
			href={data.workItem?.parentId
				? `/work-items/${data.workItem?.parentId}`
				: `/work-items?clientId=${data.workItem.clientId}`}>Go to Parent</A
		>
	</div>
</form>
<hr class="my-4" />
<h3 class="text-2xl">Children</h3>
{#if data.workItem?.children?.length !== 0}
	<Table>
		<thead>
			<tr>
				<TH>ID</TH>
				<TH>Name</TH>
				<TH>Type</TH>
				<TH>Status</TH>
			</tr>
		</thead>
		<tbody>
			{#each childItemsSorted as child (child.id)}
				<tr>
					<TD>{child.id}</TD>
					<TD><A href={`/work-items/${child.id}`}>{child.name}</A></TD>
					<TD>{child.type}</TD>
					<TD>{child.status}</TD>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}
<div class="mt-4 flex items-center gap-2">
	<A href={`/work-items/new?parentId=${data.workItem?.id}&clientId=${data.workItem?.clientId}`}
		>New Child</A
	>
</div>
<hr class="my-4" />
<h3 class="text-2xl">Documents</h3>
{#if data.workItem?.documents?.length !== 0}
	<Table>
		<thead>
			<tr>
				<TH>Name</TH>
				<TH>Summary</TH>
			</tr>
		</thead>
		<tbody>
			{#each documentsSorted as document (document.id)}
				<tr>
					<TD
						><A href={`/work-items/${data.workItem?.id}/documents/${document.id}`}
							>{document.name}</A
						></TD
					>
					<TD>{document.summary}</TD>
				</tr>
			{/each}
		</tbody>
	</Table>
{/if}
<div class="mt-4 flex items-center gap-2">
	<A href={`/work-items/${data.workItem?.id}/documents/new`}>New Document</A>
</div>
