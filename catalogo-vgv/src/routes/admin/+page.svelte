<script>
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	onMount(() => {
		goto(resolve('/admin/dashboard'));
	});
</script>

<svelte:head>
	<title>Redirigiendo...</title>
</svelte:head>

<section class="redirect-card card">
	<p>Redirigiendo al panel de control...</p>
</section>

<style>
	.redirect-card {
		max-width: 560px;
		margin: 2rem auto;
		text-align: center;
	}
</style>
