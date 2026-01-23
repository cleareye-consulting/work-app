<script lang="ts">
	const { children, class: customClass = '', ...rest } = $props();
</script>

<label class="block text-sm font-medium text-gray-900">
	{@render children()}
</label>
<textarea rows="1"
		class={`block w-full px-4 py-2 border border-gray-400 rounded-sm bg-gray-100
             focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50
             focus:outline-none text-gray-900 placeholder-gray-500 ${customClass}`}
		{...rest}
	>
</textarea>
