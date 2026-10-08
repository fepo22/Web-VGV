<script>
	import '../app.css';
	import { page } from '$app/state';

	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const { children } = $props();
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	const isHomeRoute = $derived(page.url.pathname === '/');
	const isContactRoute = $derived(page.url.pathname === '/contacto');
	const isLegacyPage = $derived(isHomeRoute || isContactRoute);
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" sizes="any" />
</svelte:head>

{#if !isAdminRoute && !isContactRoute}
	<Navbar />
{/if}

<main class:contenido={!isLegacyPage}>
	{@render children()}
</main>

{#if !isAdminRoute && !isContactRoute}
	<Footer />
{/if}

<style>
	.contenido {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}
</style>
