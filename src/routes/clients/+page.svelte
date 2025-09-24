<script>
	import ContentHeader from '../../components/ContentHeader.svelte';
	import DataTable from '../../components/DataTable.svelte';
	import A from '../../components/A.svelte';
	export let data
</script>

<ContentHeader pageTitle="Clients" />
<div class="my-4">
<DataTable columns={["name", "isActive"]} items={data.clients} entity="clients" />
</div>
<hr>
<A href="/clients/new">New Client</A>