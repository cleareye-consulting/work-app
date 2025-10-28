<script>
	const { children, class: customClass = '', ...rest } = $props();
</script>
<th class="border border-gray-300 px-1 py-1 {customClass}" {...rest}>
	{@render children?.()}
</th>
