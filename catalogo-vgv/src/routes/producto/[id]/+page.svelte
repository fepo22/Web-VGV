<script>
	import { browser } from '$app/environment';
	import { agregarAlCarrito } from '$lib/stores/carrito.js';

	const { data } = $props();
	const producto = $derived(data?.producto ?? null);
	let ultimoProductoRegistrado = $state(null);

	function agregar() {
		if (producto) {
			agregarAlCarrito(producto);
		}
	}

	function registrarProductoVisto(id) {
		if (!browser || !id) return;

		try {
			const raw = localStorage.getItem('vgv_recently_viewed') ?? '[]';
			const recientes = JSON.parse(raw);
			const lista = Array.isArray(recientes) ? recientes : [];
			const siguiente = [id, ...lista.filter((item) => item !== id)].slice(0, 4);
			localStorage.setItem('vgv_recently_viewed', JSON.stringify(siguiente));
		} catch {
			// Ignorar errores de almacenamiento local
		}
	}

	$effect(() => {
		if (!producto?.id || ultimoProductoRegistrado === producto.id) return;
		registrarProductoVisto(producto.id);
		ultimoProductoRegistrado = producto.id;
	});
</script>

{#if producto}
	<section class="producto">
		<div class="imagen">
			<img src={producto.imagen} alt={producto.nombre} />
		</div>

		<div class="info">
			<h1>{producto.nombre}</h1>
			<p class="precio">${producto.precio.toLocaleString('es-CL')}</p>
			<p class="descripcion">{producto.descripcion}</p>
			<button class="btn" type="button" onclick={agregar}>Agregar al carrito</button>
		</div>
	</section>
{:else}
	<p class="empty">No se encontró el producto.</p>
{/if}

<style>
	.producto {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		margin-top: 1rem;
	}

	.imagen img {
		width: 100%;
		border-radius: 8px;
		border: 2px solid var(--vgv-gris-claro);
		background: var(--vgv-gris-claro);
		object-fit: contain;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
		margin-bottom: 1rem;
	}

	.precio {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--vgv-verde);
		margin-bottom: 1rem;
	}

	.descripcion {
		font-size: 1rem;
		color: var(--vgv-gris);
		margin-bottom: 2rem;
	}

	.btn {
		background: var(--vgv-azul);
		color: var(--vgv-blanco);
		padding: 0.9rem 1.6rem;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: 0.2s ease;
	}

	.btn:hover {
		background: var(--vgv-azul-oscuro);
	}

	.empty {
		color: var(--vgv-gris);
		padding: 2rem 0;
	}

	@media (max-width: 800px) {
		.producto {
			grid-template-columns: 1fr;
		}
	}
</style>
