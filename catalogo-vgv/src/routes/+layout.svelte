<script>
	import '../app.css';
	import { page } from '$app/state';

	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const { children } = $props();
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	const isLegacyPage = $derived(page.url.pathname === '/' || page.url.pathname === '/contacto');
</script>

{#if !isAdminRoute && !isLegacyPage}
	<Navbar titulo="Catálogo VGV" />
{/if}

<main class:contenido={!isLegacyPage}>
	{@render children()}
</main>

{#if !isAdminRoute && !isLegacyPage}
	<Footer />
{/if}

<style>
	.contenido {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}
</style>
