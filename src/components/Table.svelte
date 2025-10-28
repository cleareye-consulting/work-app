<script lang="ts">
	const { children, class: customClass = '', ...rest } = $props();
</script>

<table class="table-fixed border border-gray-300 {customClass}" {...rest}>
	{@render children?.()}
</table>