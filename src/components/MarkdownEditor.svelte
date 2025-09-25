<script lang="ts">
	import {marked} from 'marked';
	let { value = $bindable() } = $props()
	let htmlPreview = $derived(marked.parse(value))
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
			class={`block w-full h-80 p-4 border rounded-md resize-none ${mode === 'preview' ? 'hidden': ''}`}
			placeholder="Start typing your Markdown here..."
		></textarea>
		<div class={`block w-full h-80 p-4 border rounded-md resize-none ${mode === 'edit' ? 'hidden': ''}`}>
			{@html htmlPreview}
		</div>
	</div>

</div>
