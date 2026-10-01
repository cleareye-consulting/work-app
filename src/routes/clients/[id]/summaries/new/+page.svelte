<script lang="ts">
	import ContentHeader from '../../../../../components/ContentHeader.svelte';
	import MarkdownEditor from '../../../../../components/MarkdownEditor.svelte';
	import Button from '../../../../../components/Button.svelte';
	import A from '../../../../../components/A.svelte';
	import { deserialize } from '$app/forms';

	let { data, form } = $props();
	let content = $state('');
	let period = $state('month-to-date');
	let isGenerating = $state(false);
	let isCopied = $state(false);
	let error = $state('');

	$effect(() => {
		if (form?.generatedContent) content = form.generatedContent;
		if (form?.period) period = form.period;
		if (form?.error) error = form.error;
	});

	async function handleGenerate() {
		isGenerating = true;
		error = '';
		isCopied = false;
		try {
			const formData = new FormData();
			formData.set('period', period);
			const response = await fetch('?/generate', { method: 'POST', body: formData });
			const result = deserialize(await response.text());
			if (result.type === 'success' && result.data && typeof result.data.generatedContent === 'string') {
				content = result.data.generatedContent;
			} else if (result.type === 'failure' && result.data?.error) {
				error = String(result.data.error);
			}
		} finally {
			isGenerating = false;
		}
	}

	async function copyContent() {
		await navigator.clipboard.writeText(content);
		isCopied = true;
	}
</script>

<ContentHeader>Generate Client Update: {data.client.name}</ContentHeader>

<div class="max-w-4xl">
	<div class="mb-4 flex flex-wrap items-end justify-between gap-4">
		<label class="flex flex-col gap-1">
			<span class="font-medium">Reporting period</span>
			<select bind:value={period} class="rounded border border-gray-300 bg-white px-3 py-2">
				<option value="month-to-date">This month to date</option>
				<option value="last-calendar-month">Last calendar month</option>
				<option value="week-to-date">This week so far</option>
				<option value="last-week">Last week</option>
			</select>
		</label>
		<Button type="button" onclick={handleGenerate} disabled={isGenerating}>
			{isGenerating ? 'Generating...' : 'Generate update'}
		</Button>
	</div>

	<p class="mb-4 text-sm text-gray-500">Generated updates are not saved.</p>

	{#if error}
		<p class="mb-4 text-red-700">{error}</p>
	{/if}

	{#if content}
		<div class="mb-4 flex justify-end">
			<Button type="button" onclick={copyContent}>{isCopied ? 'Copied' : 'Copy to clipboard'}</Button>
		</div>
	{/if}
	<div class="mb-4">
		<MarkdownEditor bind:value={content} />
	</div>
	<A href="/clients/{data.client.id}">Back to client</A>
</div>
