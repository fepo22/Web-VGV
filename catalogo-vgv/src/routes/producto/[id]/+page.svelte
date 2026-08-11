<script>
	import { browser } from '$app/environment';
	import { agregarAlCarrito } from '$lib/stores/carrito.js';

	const { data } = $props();
	const producto = $derived(data?.producto ?? null);
	const variantes = $derived(Array.isArray(producto?.variantes) ? producto.variantes : []);
	let ultimoProductoRegistrado = $state(null);
	let cantidadesPorVariante = $state({});

	function agregar() {
		if (producto) {
			agregarAlCarrito(producto);
		}
	}

	function actualizarCantidadVariante(sku, value) {
		const parsed = Number(value);
		cantidadesPorVariante = {
			...cantidadesPorVariante,
			[sku]: Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
		};
	}

	function agregarVariantes() {
		if (!producto || !variantes.length) return;

		for (const variante of variantes) {
			const cantidad = Number(cantidadesPorVariante[variante.sku] ?? 0);
			const minima = Math.max(1, Number(variante.minima ?? 1));
			if (!Number.isFinite(cantidad) || cantidad < minima) continue;

			agregarAlCarrito({
				id: producto.id,
				nombre: `${producto.nombre} · ${variante.medida}`,
				precio: Number(variante.precio ?? producto.precio ?? 0),
				descripcion: `${producto.descripcion} (SKU ${variante.sku})`,
				imagen: producto.imagen,
				categoria: producto.categoria,
				categoriaSlug: producto.categoriaSlug,
				varianteSku: variante.sku,
				varianteMedida: variante.medida,
				minima: minima,
				cantidad
			});
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

			{#if variantes.length > 0}
				<div class="variantes-box">
					<h2>Medidas disponibles</h2>
					<div class="variantes-head" aria-hidden="true">
						<span>Medida</span>
						<span>SKU</span>
						<span>Precio</span>
						<span>Cantidad</span>
					</div>
					{#each variantes as variante (variante.sku)}
						<div class="variante-row">
							<div>
								<strong>{variante.medida}</strong>
								<small>Cantidad minima: {variante.minima}</small>
							</div>
							<span class="sku">{variante.sku}</span>
							<span class="variante-precio">${Number(variante.precio).toLocaleString('es-CL')}</span
							>
							<input
								type="number"
								min="0"
								step="1"
								value={cantidadesPorVariante[variante.sku] ?? 0}
								oninput={(e) => actualizarCantidadVariante(variante.sku, e.currentTarget.value)}
							/>
						</div>
					{/each}
					<button class="btn" type="button" onclick={agregarVariantes}>Agregar seleccionadas</button
					>
				</div>
			{:else}
				<button class="btn" type="button" onclick={agregar}>Agregar al carrito</button>
			{/if}
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

	.variantes-box {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1rem;
		border: 1px solid var(--vgv-gris-claro);
		border-radius: 8px;
		background: #f9fbff;
	}

	.variantes-box h2 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--vgv-azul-oscuro);
	}

	.variantes-head,
	.variante-row {
		display: grid;
		grid-template-columns: minmax(180px, 1fr) 110px 110px 100px;
		gap: 0.6rem;
		align-items: center;
	}

	.variantes-head {
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
		font-size: 0.9rem;
	}

	.variante-row {
		padding: 0.6rem 0;
		border-top: 1px solid #e6edf6;
	}

	.variante-row strong,
	.variante-row small {
		display: block;
	}

	.variante-row small {
		font-size: 0.8rem;
		color: var(--vgv-gris);
		margin-top: 0.1rem;
	}

	.sku {
		font-weight: 600;
		color: var(--vgv-azul);
	}

	.variante-precio {
		font-weight: 700;
		color: var(--vgv-verde);
	}

	.variante-row input {
		width: 100%;
		padding: 0.35rem 0.45rem;
		border: 1px solid #cddaea;
		border-radius: 6px;
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

		.variantes-head {
			display: none;
		}

		.variante-row {
			grid-template-columns: 1fr;
			gap: 0.35rem;
		}
	}
</style>
