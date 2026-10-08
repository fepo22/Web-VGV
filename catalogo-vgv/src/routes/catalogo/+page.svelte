<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { familias, normalizeFamiliaSlug } from '$lib/data/categorias.js';
	import Loader from '$lib/components/Loader.svelte';
	import ProductGrid from '$lib/components/ProductGrid.svelte';

	let productos = $state([]);
	let cargando = $state(true);
	let errorCarga = $state('');

	function productoDisponible(producto) {
		return (
			Number(producto?.stock ?? 0) > 0 && String(producto?.estado ?? 'disponible') !== 'sin stock'
		);
	}

	const familiaActiva = $derived(
		normalizeFamiliaSlug(
			$page.url.searchParams.get('familia') ?? $page.url.searchParams.get('linea') ?? 'todas'
		)
	);
	const subfamiliaActiva = $derived($page.url.searchParams.get('subfamilia') ?? '');
	const categoriaActiva = $derived($page.url.searchParams.get('categoria') ?? '');
	const familiaSeleccionada = $derived(familias.find((item) => item.slug === familiaActiva));
	const subfamiliaSeleccionada = $derived(
		familiaSeleccionada?.subfamilias.find((item) => item.slug === subfamiliaActiva)
	);
	const productosDisponibles = $derived(productos.filter(productoDisponible));
	const productosPorCategoria = $derived(
		productosDisponibles.filter((producto) => {
			const productoFamilia = normalizeFamiliaSlug(
				producto.familiaSlug || producto.categoriaSlug || ''
			);
			if (familiaActiva !== 'todas' && productoFamilia !== familiaActiva) return false;
			if (subfamiliaActiva && producto.subfamiliaSlug !== subfamiliaActiva) return false;
			if (categoriaActiva && producto.categoriaSlug !== categoriaActiva) return false;
			return true;
		})
	);
	const tituloCategoria = $derived(
		[
			familiaSeleccionada?.nombre,
			subfamiliaSeleccionada?.nombre,
			subfamiliaSeleccionada?.categorias?.find((item) => item.slug === categoriaActiva)?.nombre
		]
			.filter(Boolean)
			.join(' / ') || 'Todas las familias'
	);
	const seoTitle = $derived(
		tituloCategoria === 'Todas las familias'
			? 'Catálogo de materiales de construcción | VGV SPA'
			: `${tituloCategoria} | VGV SPA`
	);
	const seoDescription = $derived(
		tituloCategoria === 'Todas las familias'
			? 'Explora tuberías y fittings, calefacción, grifería, baño, cocina, adhesivos y consumibles de obra. Consulta productos y solicita una cotización a VGV SPA en Talcahuano.'
			: `Consulta el catálogo de ${tituloCategoria.replaceAll(' / ', ', ')}, productos para construcción e instalaciones. Solicita una cotización a VGV SPA en Talcahuano.`
	);

	function catalogoHref(familia = '', subfamilia = '', categoria = '') {
		const params = [
			familia && `familia=${encodeURIComponent(familia)}`,
			subfamilia && `subfamilia=${encodeURIComponent(subfamilia)}`,
			categoria && `categoria=${encodeURIComponent(categoria)}`
		].filter(Boolean);
		return params.length ? `/catalogo?${params.join('&')}` : '/catalogo';
	}

	async function cargarProductos() {
		cargando = true;
		errorCarga = '';
		try {
			const respuesta = await fetch('/api/products');
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

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={seoDescription} />
	<link rel="canonical" href={`https://www.vgv.cl${$page.url.pathname}${$page.url.search}`} />
</svelte:head>

<section class="catalogo">
	<h1>Catálogo virtual VGV</h1>
	<p class="intro">Explora por líneas de producto y encuentra exactamente lo que necesitas.</p>

	<nav class="taxonomy" aria-label="Familias y categorías de producto">
		<div class="taxonomy-level">
			<h2>Familia</h2>
			<div class="taxonomy-options">
				<a class:active={familiaActiva === 'todas'} href={resolve(catalogoHref())}>Todas</a>
				{#each familias as familia (familia.slug)}
					<a
						class:active={familiaActiva === familia.slug}
						href={resolve(catalogoHref(familia.slug))}>{familia.nombre}</a
					>
				{/each}
			</div>
		</div>

		{#if familiaSeleccionada}
			<div class="taxonomy-level">
				<h2>Subfamilia</h2>
				<div class="taxonomy-options">
					<a class:active={!subfamiliaActiva} href={resolve(catalogoHref(familiaActiva))}>Todas</a>
					{#each familiaSeleccionada.subfamilias as subfamilia (subfamilia.slug)}
						<a
							class:active={subfamiliaActiva === subfamilia.slug}
							href={resolve(catalogoHref(familiaActiva, subfamilia.slug))}>{subfamilia.nombre}</a
						>
					{/each}
				</div>
			</div>
		{/if}

		{#if subfamiliaSeleccionada?.categorias?.length}
			<div class="taxonomy-level">
				<h2>Categoría</h2>
				<div class="taxonomy-options">
					<a
						class:active={!categoriaActiva}
						href={resolve(catalogoHref(familiaActiva, subfamiliaActiva))}>Todas</a
					>
					{#each subfamiliaSeleccionada.categorias as categoria (categoria.slug)}
						<a
							class:active={categoriaActiva === categoria.slug}
							href={resolve(catalogoHref(familiaActiva, subfamiliaActiva, categoria.slug))}
							>{categoria.nombre}</a
						>
					{/each}
				</div>
			</div>
		{/if}
	</nav>

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

	.taxonomy {
		margin: 1.2rem 0 1rem;
		border-top: 1px solid #d9e5f2;
		border-bottom: 1px solid #d9e5f2;
	}

	.taxonomy-level {
		padding: 0.85rem 0;
		border-bottom: 1px solid #e7eef6;
	}

	.taxonomy-level:last-child {
		border-bottom: 0;
	}

	.taxonomy-level h2 {
		margin: 0 0 0.55rem;
		color: var(--vgv-azul-oscuro);
		font-size: 0.9rem;
	}

	.taxonomy-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.taxonomy-options a {
		padding: 0.45rem 0.7rem;
		border: 1px solid #d9e5f2;
		border-radius: 4px;
		color: var(--vgv-azul-oscuro);
		text-decoration: none;
		background: white;
	}

	.taxonomy-options a:hover,
	.taxonomy-options a.active {
		border-color: var(--vgv-verde);
		background: #eef7f0;
		color: var(--vgv-verde-oscuro);
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
