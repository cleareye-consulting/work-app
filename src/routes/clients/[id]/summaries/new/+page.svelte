<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import Button from '../../../../../components/Button.svelte';
	import A from '../../../../../components/A.svelte';

	let { data } = $props();
	let content = $state('');
</script>

<ContentHeader>New Summary</ContentHeader>

<form method="POST" class="max-w-4xl">
	<div class="mb-4">
		<MarkdownEditor bind:value={content} />
	</div>
	<div class="flex items-center gap-4">
		<Button>Create Summary</Button>
		<A href="/clients/{data.clientId}">Cancel</A>
	</div>
</form>
