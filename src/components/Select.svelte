<script lang="ts">
	const {
		class: customClass = '',
		name,
		children,
		...rest
	} = $props();

	const inputId = rest.id || name
	const label = rest.label || name
</script>

<label for={inputId} class="block mb-4">
	<span class="block text-sm font-medium text-gray-700">
		{label}
	</span>
	<select
		id={inputId}
		class="block w-lg px-4 py-2 border border-gray-400 rounded-sm bg-gray-100
           focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-none text-gray-900 placeholder-gray-500 {customClass}"
		{...rest}
	>
		{@render children?.()}
	</select>
</label>
