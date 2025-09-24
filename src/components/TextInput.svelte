<script>
	let {id, name, label, value} = $props()
</script>
<div class="my-2">
<label for={id} class="block text-gray-700 font-bold mb-2">{label}</label>
<input
	type="text"
	id={id}
	name={name}
	value={value}
	class="block w-lg px-4 py-2 border border-gray-400 rounded-sm bg-gray-100
           focus:border-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 focus:outline-nonetext-gray-900 placeholder-gray-500" />
</div>