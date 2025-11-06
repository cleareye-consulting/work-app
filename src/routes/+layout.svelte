<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="container mx-auto">
	<h1 class="text-4xl my-3 font-bold"><a href="/">Work App</a></h1>
{@render children?.()}
</div>