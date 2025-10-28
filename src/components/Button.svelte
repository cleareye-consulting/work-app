<script lang="ts">
	const {
		children,
		type = 'submit' as 'button' | 'reset' | 'submit',
		class: customClass = '',
		...rest } = $props();
</script>

<button
	type={type}
	class="px-4 py-2 my-2 font-semibold text-white bg-blue-500 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 {customClass}"
	{...rest}>
	{@render children?.()}
</button>