<script>
	import '../app.css';

	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const { children } = $props();
</script>

<Navbar titulo="Catálogo VGV" />

<main class="contenido">
	{@render children()}
</main>

<Footer />

<style>
	.contenido {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}
</style>
