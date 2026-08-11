<script>
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { productos as catalogoProductos } from '$lib/data/productos.js';
	import {
		agregarAlCarrito,
		carrito,
		actualizarCantidad,
		eliminarDelCarrito,
		vaciarCarrito
	} from '$lib/stores/carrito.js';

	let items = $state([]);

	$effect(() => {
		const unsub = carrito.subscribe((value) => {
			items = value;
		});

		return () => unsub();
	});

	function total() {
		return items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
	}

	function leerProductosVistos() {
		if (!browser) return [];

		try {
			const raw = localStorage.getItem('vgv_recently_viewed') ?? '[]';
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	const categoriasEnCarrito = $derived(
		new Set(items.map((item) => item.categoriaSlug || item.categoria))
	);
	const productosVistosRecientemente = $derived(
		leerProductosVistos()
			.map((id) => catalogoProductos.find((producto) => producto.id === id))
			.filter(Boolean)
			.filter((producto) => !items.some((item) => item.id === producto.id))
			.slice(0, 2)
	);
	const productosComplementarios = $derived(
		items.length === 0
			? []
			: catalogoProductos
					.filter((producto) => !items.some((item) => item.id === producto.id))
					.filter(
						(producto) => !productosVistosRecientemente.some((item) => item.id === producto.id)
					)
					.filter((producto) =>
						categoriasEnCarrito.has(producto.categoriaSlug || producto.categoria)
					)
					.slice(0, 3)
	);
	const productosRelacionados = $derived([
		...productosVistosRecientemente,
		...productosComplementarios
	]);
</script>

<section class="carrito">
	<h1>Carrito de Compras</h1>

	{#if items.length === 0}
		<p class="vacio">Tu carrito está vacío.</p>
	{:else}
		<div class="lista">
			{#each items as item (item.cartKey)}
				<article class="item">
					<img src={item.imagen} alt={item.nombre} />

					<div class="info">
						<h3>{item.nombre}</h3>
						{#if item.varianteSku}
							<p class="meta-variante">SKU: {item.varianteSku}</p>
						{/if}
						<p class="precio">${item.precio.toLocaleString('es-CL')}</p>

						<div class="controls">
							<button
								type="button"
								onclick={() => actualizarCantidad(item.cartKey, item.cantidad - 1)}>-</button
							>
							<span>{item.cantidad}</span>
							<button
								type="button"
								onclick={() => actualizarCantidad(item.cartKey, item.cantidad + 1)}>+</button
							>
						</div>

						<button class="eliminar" type="button" onclick={() => eliminarDelCarrito(item.cartKey)}>
							Eliminar
						</button>
					</div>
				</article>
			{/each}
		</div>

		<div class="total">
			<h2>Total: ${total().toLocaleString('es-CL')}</h2>
			<a class="btn-pagar" href={resolve('/checkout')}>Finalizar compra</a>
			<button class="btn-vaciar" type="button" onclick={vaciarCarrito}>Vaciar carrito</button>
		</div>

		{#if productosRelacionados.length > 0}
			<section class="relacionados">
				<h2>Productos relacionados</h2>
				<div class="relacionados-grid">
					{#each productosRelacionados as producto (producto.id)}
						<article class="relacionado-card">
							{#if productosVistosRecientemente.some((item) => item.id === producto.id)}
								<span class="badge">Visto recientemente</span>
							{/if}
							<img src={producto.imagen} alt={producto.nombre} />
							<div class="relacionado-info">
								<h3>{producto.nombre}</h3>
								<p class="precio">${producto.precio.toLocaleString('es-CL')}</p>
								<p>{producto.descripcion}</p>
								<div class="acciones">
									<a href={resolve(`/producto/${producto.id}`)}>Ver detalle</a>
									<button type="button" onclick={() => agregarAlCarrito(producto)}>
										Agregar al carrito
									</button>
								</div>
							</div>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</section>

<style>
	.carrito {
		padding: 1rem 0 2rem;
	}

	h1 {
		font-size: 1.8rem;
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
		margin-bottom: 1.5rem;
	}

	.vacio {
		font-size: 1.2rem;
		color: var(--vgv-gris);
	}

	.lista {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
		margin-bottom: 2rem;
	}

	.item {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--vgv-gris-claro);
		border-radius: 8px;
		background: var(--vgv-blanco);
	}

	img {
		width: 120px;
		height: 120px;
		object-fit: contain;
		border-radius: 6px;
		background: var(--vgv-gris-claro);
	}

	.info h3 {
		margin: 0;
		color: var(--vgv-azul);
	}

	.meta-variante {
		margin: 0.2rem 0 0;
		font-size: 0.86rem;
		color: var(--vgv-gris);
	}

	.precio {
		font-weight: 700;
		color: var(--vgv-verde);
	}

	.controls {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0.5rem 0;
	}

	.controls button {
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 50%;
		background: var(--vgv-azul);
		color: white;
		cursor: pointer;
	}

	.eliminar {
		background: transparent;
		border: none;
		color: var(--vgv-azul);
		cursor: pointer;
		padding: 0;
	}

	.eliminar:hover {
		color: var(--vgv-azul-oscuro);
	}

	.total {
		border-top: 2px solid var(--vgv-gris-claro);
		padding-top: 1.5rem;
	}

	.btn-pagar {
		display: inline-block;
		background: var(--vgv-verde);
		color: var(--vgv-blanco);
		padding: 0.9rem 1.6rem;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 700;
		text-decoration: none;
		cursor: pointer;
		margin-right: 1rem;
	}

	.btn-pagar:hover {
		background: #3e8e41;
	}

	.btn-vaciar {
		background: var(--vgv-azul);
		color: var(--vgv-blanco);
		padding: 0.9rem 1.6rem;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-vaciar:hover {
		background: var(--vgv-azul-oscuro);
	}

	.relacionados {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 2px solid var(--vgv-gris-claro);
	}

	.relacionados h2 {
		margin-bottom: 1rem;
		color: var(--vgv-azul-oscuro);
	}

	.relacionados-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}

	.relacionado-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--vgv-gris-claro);
		border-radius: 10px;
		background: var(--vgv-blanco);
		position: relative;
	}

	.badge {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		background: var(--vgv-azul);
		color: var(--vgv-blanco);
		font-size: 0.72rem;
		font-weight: 700;
	}

	.relacionado-card img {
		width: 100%;
		height: 140px;
		object-fit: contain;
		border-radius: 6px;
		background: var(--vgv-gris-claro);
	}

	.relacionado-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.relacionado-info h3 {
		margin: 0;
		color: var(--vgv-azul);
	}

	.relacionado-info p {
		margin: 0;
		color: var(--vgv-gris);
		line-height: 1.4;
	}

	.acciones {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		margin-top: 0.2rem;
	}

	.acciones a,
	.acciones button {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--vgv-azul);
		text-decoration: none;
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.acciones button {
		color: var(--vgv-verde);
	}
</style>
