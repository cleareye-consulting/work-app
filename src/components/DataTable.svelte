<script lang="ts">
	import A from './A.svelte';

	let {columns, items, entity} = $props()
	function renderValue(value: unknown): string {
		if (typeof value === 'boolean') {
			return value ? 'Yes' : 'No';
		}
		return value as string
	}
</script>

<table class="table-fixed border border-gray-300">
	<thead>
		<tr>
			{#each columns as column (column)}
				<th class="border border-gray-300 px-1 py-1">{column}</th>
			{/each}
		</tr>
	</thead>
	<tbody>
	{#each items as item, i (i)}
		<tr>
			{#each columns as column, j (column)}
				<td class="border border-gray-300 px-1 py-1">
					{#if j === 0}
						<A href={`/${entity}/${item.id}`}>{item[column]}</A>
					{:else}
						<span>{renderValue(item[column])}</span>
				{/if}
				</td>
			{/each}
		</tr>
	{/each}
	</tbody>
</table>