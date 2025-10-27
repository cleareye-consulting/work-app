<script lang="ts">
	import {marked} from 'marked';
	let { value = $bindable() } = $props()
	let htmlPreview = $derived(marked.parse(value, {
		gfm: true,        // Enable GitHub Flavored Markdown (often includes tables)
		breaks: true,     // Convert single line breaks to <br>
	}))
	let mode = $state<'edit' | 'preview'>('edit')
</script>

<div class="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
	<div class="flex-1">
		<div class="my-2">
			<label for="mode-edit">
				<input type="radio" id="mode-edit" name="mode" value="edit" bind:group={mode} />
				<span>edit</span>
			</label>
			<label for="mode-preview">
				<input type="radio" id="mode-preview" name="mode" value="preview" bind:group={mode} />
				<span>preview</span>
			</label>
		</div>
		<textarea
			id="markdown-input"
			bind:value
			name="content"
			class={`block w-full h-120 p-4 border rounded-md resize-none ${mode === 'preview' ? 'hidden': ''}`}
			placeholder="Start typing your Markdown here..."
		></textarea>
		<div class={`block w-full h-120 p-4 border rounded-md overflow-y-auto resize-none ${mode === 'edit' ? 'hidden': ''}`}>
			<div class="prose max-w-none">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html htmlPreview}
			</div>
		</div>
	</div>

</div>
