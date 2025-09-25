<script>
	let {href, children} = $props()
</script>

<a class="text-blue-600 underline hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75"
	 {href}>{@render children()}</a>