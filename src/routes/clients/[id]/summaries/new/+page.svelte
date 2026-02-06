<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import Button from '../../../../../components/Button.svelte';
	import A from '../../../../../components/A.svelte';
	import { deserialize } from '$app/forms';

	let { data, form } = $props();
	let content = $state('');
	let isGenerating = $state(false);

	$effect(() => {
		if (form?.generatedContent) {
			content = form.generatedContent;
		}
	});

	async function handleGenerate() {
		isGenerating = true;
		try {
			const response = await fetch('?/generate', {
				method: 'POST',
				body: new FormData()
			});
			const result = deserialize(await response.text());
			if (result.type === 'success' && result.data && typeof result.data.generatedContent === 'string') {
				content = result.data.generatedContent;
			}
		} finally {
			isGenerating = false;
		}
	}
</script>

<ContentHeader>New Summary</ContentHeader>

<form method="POST" action="?/create" class="max-w-4xl">
	<div class="mb-4 flex justify-end">
		<Button type="button" onclick={handleGenerate} disabled={isGenerating}>
			{isGenerating ? 'Generating...' : 'Auto-generate'}
		</Button>
	</div>
	<div class="mb-4">
		<MarkdownEditor bind:value={content} />
	</div>
	<div class="flex items-center gap-4">
		<Button>Create Summary</Button>
		<A href="/clients/{data.clientId}">Cancel</A>
	</div>
</form>
