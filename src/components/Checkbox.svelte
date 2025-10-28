<script>
	const { children, name, checked = false, class: customClass = '', ...rest } = $props();
	const inputId = rest.id || name;
</script>
<label for={inputId}>
	<input type="checkbox" class={customClass} id={inputId} name={name} value={inputId} checked={checked} {...rest} />
	{@render children?.()}
</label>