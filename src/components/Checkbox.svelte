<script>
	let {id, name, isChecked, label} = $props()
</script>
<label for={id}>
	<input type="checkbox" id={id} name={name} value={id} checked={isChecked} />
	{label}
</label>