<script lang="ts">
	const { children, class: customClass = '', ...rest } = $props();
</script>

<label>
	{@render children()}
	<textarea
		class={`block w-lg px-4 py-2 border border-gray-400 rounded-sm bg-gray-100
             focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50
             focus:outline-none text-gray-900 placeholder-gray-500 ${customClass}`}
		{...rest}
	></textarea>
</label>