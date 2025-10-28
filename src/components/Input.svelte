<script lang="ts">
	const {
		type = 'text',
		class: customClass = '',
		children,
		...rest
	} = $props();

	const inputId = rest.id || rest.name || `input-${Math.random().toString(36).substring(2, 9)}`;
</script>

<label for={inputId} class="block mb-4">
	{#if children}
    <span class="block text-sm font-medium text-gray-700">
      {@render children()}
    </span>
	{/if}

	<input
		type={type}
		id={inputId}
		class="block w-lg px-4 py-2 border border-gray-400 rounded-sm bg-gray-100
           focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none text-gray-900 placeholder-gray-500 {customClass}"
		{...rest}
	/>
</label>