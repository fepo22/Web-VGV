<script>
	import '../app.css';
	import { page } from '$app/state';

	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const { children } = $props();
	const isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
</script>

{#if !isAdminRoute}
	<Navbar titulo="Catálogo VGV" />
{/if}

<main class="contenido">
	{@render children()}
</main>

{#if !isAdminRoute}
	<Footer />
{/if}

<style>
	.contenido {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}
</style>
