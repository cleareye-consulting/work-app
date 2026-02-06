<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import { signIn, signOut } from '@auth/sveltekit/client';

	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" sizes="180x180" href="/favicon.png" />
	<link rel="apple-touch-icon-precomposed" href="/favicon.png" />
</svelte:head>

<div class="container mx-auto">
	<div class="flex items-center justify-between">
		<h1 class="my-3 text-4xl font-bold"><a href="/">Work App</a></h1>
		{#if data.session}
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-600">{data.session.user?.email}</span>
				<button
					onclick={() => signOut()}
					class="rounded bg-gray-200 px-3 py-1 text-sm font-medium hover:bg-gray-300"
				>
					Sign Out
				</button>
			</div>
		{:else}
			<button
				onclick={() => signIn('google')}
				class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
			>
				Sign In
			</button>
		{/if}
	</div>
	{@render children?.()}
</div>
