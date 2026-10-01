<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import Loader from '$lib/components/Loader.svelte';
	import ProductGrid from '$lib/components/ProductGrid.svelte';
	import { categorias } from '$lib/data/categorias.js';
	import { backendUrl } from '$lib/utils/backend-url.js';

	let productos = $state([]);
	let cargando = $state(true);
	let errorCarga = $state('');

	function productoDisponible(producto) {
		return (
			Number(producto?.stock ?? 0) > 0 && String(producto?.estado ?? 'disponible') !== 'sin stock'
		);
	}

	const categoriaActiva = $derived($page.url.searchParams.get('linea') ?? 'todas');
	const productosDisponibles = $derived(productos.filter(productoDisponible));
	const productosPorCategoria = $derived(
		categoriaActiva === 'todas'
			? productosDisponibles
			: productosDisponibles.filter((producto) => producto.categoriaSlug === categoriaActiva)
	);
	const tituloCategoria = $derived(
		categorias.find((c) => c.slug === categoriaActiva)?.nombre ?? 'Todas las líneas'
	);

	async function cargarProductos() {
		cargando = true;
		errorCarga = '';
		try {
			const respuesta = await fetch(backendUrl('/api/products'));
			if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);
			const data = await respuesta.json();
			if (!Array.isArray(data)) throw new Error('La respuesta del catálogo no es válida');
			productos = data;
		} catch (error) {
			console.error('Error cargando productos:', error);
			productos = [];
			errorCarga = 'No se pudo cargar el catálogo. Inténtalo de nuevo en unos minutos.';
		} finally {
			cargando = false;
		}
	}

	onMount(() => {
		void cargarProductos();
	});
</script>

<section class="catalogo">
	<h1>Catálogo virtual VGV</h1>
	<p class="intro">Explora por líneas de producto y encuentra exactamente lo que necesitas.</p>

	<section class="lineas" aria-label="Líneas de producto">
		<a class="linea-card" href={resolve('/catalogo?linea=todas')}>
			<h2>Todas</h2>
			<p>Ver catálogo completo</p>
		</a>
		{#each categorias as categoria (categoria.slug)}
			<a class="linea-card" href={resolve(`/catalogo?linea=${categoria.slug}`)}>
				<h2>{categoria.nombre}</h2>
				<p>{categoria.descripcion}</p>
			</a>
		{/each}
	</section>

	<p class="estado-filtro">Mostrando: <strong>{tituloCategoria}</strong></p>

	{#if cargando}
		<Loader />
	{:else if errorCarga}
		<div class="sin-resultados" role="alert">
			<p>{errorCarga}</p>
			<button type="button" onclick={cargarProductos}>Reintentar</button>
		</div>
	{:else if productosPorCategoria.length === 0}
		<p class="sin-resultados">Aun no hay productos cargados para esta linea.</p>
	{:else}
		<ProductGrid productos={productosPorCategoria} />
	{/if}
</section>

<style>
	.catalogo {
		padding: 1rem 0 2rem;
	}

	.lineas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		margin: 1.2rem 0 1rem;
	}

	.linea-card {
		text-decoration: none;
		color: inherit;
		background: white;
		border: 1px solid #e7eef6;
		border-radius: 14px;
		padding: 1rem;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			border-color 0.2s ease;
	}

	.linea-card:hover {
		transform: translateY(-3px);
		border-color: var(--vgv-azul);
		box-shadow: 0 10px 24px rgba(0, 87, 160, 0.12);
	}

	.linea-card h2 {
		margin: 0 0 0.35rem;
		font-size: 1.1rem;
		color: var(--vgv-azul-oscuro);
	}

	.linea-card p {
		margin: 0;
		color: var(--vgv-gris);
		line-height: 1.35;
		font-size: 0.92rem;
	}

	h1 {
		font-size: 1.8rem;
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
		margin-bottom: 0.5rem;
	}

	.intro {
		color: var(--vgv-gris);
		margin-bottom: 0.8rem;
	}

	.estado-filtro {
		color: var(--vgv-gris);
		margin-bottom: 0.8rem;
	}

	.sin-resultados {
		background: white;
		border: 1px dashed #c8d8eb;
		color: var(--vgv-gris);
		border-radius: 12px;
		padding: 1rem;
	}
</style>
