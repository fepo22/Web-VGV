<script>
	const { productos = [] } = $props();
	import ProductCard from './ProductCard.svelte';
</script>

<div class="grid">
	{#each productos as producto (producto.id)}
		<ProductCard {producto} />
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.4rem;
		padding: 1rem 0 2rem;
	}

	@media (max-width: 600px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
