<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import Button from '../../../../../components/Button.svelte';
	import A from '../../../../../components/A.svelte';
	import type { ClientSummary } from '../../../../../types';

	let { data }: { data: { summary: ClientSummary } } = $props();
	let content = $state(data.summary.content);
</script>

<ContentHeader>Edit Summary</ContentHeader>

<form method="POST" class="max-w-4xl">
	<div class="mb-4">
		<MarkdownEditor bind:value={content} />
	</div>
	<div class="flex items-center gap-4">
		<Button>Update Summary</Button>
		<A href="/clients/{data.summary.clientId}">Cancel</A>
	</div>
</form>
