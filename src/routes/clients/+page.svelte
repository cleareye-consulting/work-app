<script>
	import ContentHeader from '../../components/ContentHeader.svelte';
	import A from '../../components/A.svelte';
	import Table from '../../components/Table.svelte';
	import TH from '../../components/TH.svelte';
	import TD from '../../components/TD.svelte';
	export let data
</script>

<ContentHeader>Clients</ContentHeader>
<div class="my-4">
	<Table>
		<thead>
			<tr>
				<TH>Name</TH>
				<TH>Active</TH>
			</tr>
		</thead>
		<tbody>
		{#each data.clients as client (client.id)}
			<tr>
				<TD><A href={`/clients/${client.id}`}>{client.name}</A></TD>
				<TD>{client.isActive ? 'Yes' : 'No'}</TD>
			</tr>
			{/each}
		</tbody>
	</Table>
</div>
<hr>
<A href="/clients/new">New Client</A>