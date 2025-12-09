<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" sizes="180x180" href="/favicon.png" />
	<link rel="apple-touch-icon-precomposed" href="/favicon.png" />
</svelte:head>

<div class="container mx-auto">
	<h1 class="my-3 text-4xl font-bold"><a href="/">Work App</a></h1>
	{@render children?.()}
</div>
