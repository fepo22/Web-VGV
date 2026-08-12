<script>
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const { children } = $props();
</script>

<Navbar titulo="Panel Admin VGV" admin={true} />

<main class="admin-contenido">
	{@render children()}
</main>

<Footer admin={true} />

<style>
	.admin-contenido {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}
</style>
