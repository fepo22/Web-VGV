<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Loader from '$lib/components/Loader.svelte';
  import ProductGrid from '$lib/components/ProductGrid.svelte';
  import { categorias } from '$lib/data/categorias.js';

  let productos = $state([]);

  const categoriaActiva = $derived($page.url.searchParams.get('linea') ?? 'todas');
  const productosFiltrados = $derived(
    categoriaActiva === 'todas'
      ? productos
      : productos.filter(producto => producto.categoriaSlug === categoriaActiva)
  );
  const tituloFiltro = $derived(
    categorias.find(c => c.slug === categoriaActiva)?.nombre ?? 'Todas las líneas'
  );

  onMount(async () => {
    const res = await fetch('/api/productos');
    productos = await res.json();
  });
</script>

<section class="catalogo">
  <h1>Catálogo de Productos</h1>
  <p class="intro">Navega por las líneas de producto de VGV y cotiza en minutos.</p>

  <section class="lineas" aria-label="Líneas de producto">
    <a class="linea-card" href="/catalogo?linea=todas">
      <h2>Todas</h2>
      <p>Ver catálogo completo</p>
    </a>
    {#each categorias as categoria}
      <a class="linea-card" href={`/catalogo?linea=${categoria.slug}`}>
        <h2>{categoria.nombre}</h2>
        <p>{categoria.descripcion}</p>
      </a>
    {/each}
  </section>

  <p class="estado-filtro">Mostrando: <strong>{tituloFiltro}</strong></p>

  {#if productos.length === 0}
    <Loader />
  {:else if productosFiltrados.length === 0}
    <p class="sin-resultados">Aun no hay productos cargados para esta linea.</p>
  {:else}
    <ProductGrid productos={productosFiltrados} />
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
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
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
