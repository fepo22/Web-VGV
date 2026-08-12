<script>
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { agregarAlCarrito } from '$lib/stores/carrito.js';

	const { producto } = $props();
	let added = $state(false);

	function tieneVariantes() {
		return Array.isArray(producto.variantes) && producto.variantes.length > 0;
	}

	function getDescuentoTexto() {
		const precio = Number(producto?.precio ?? 0);
		const precioDescuento = Number(producto?.precioDescuento ?? 0);
		if (precioDescuento > 0 && precioDescuento < precio) {
			const pctAuto = Math.max(1, Math.round(((precio - precioDescuento) / precio) * 100));
			return `${pctAuto}% OFF`;
		}

		if (!producto.oferta) return 'Oferta';
		const pct = Number(producto.descuentoPct);
		return Number.isFinite(pct) ? `${Math.max(1, Math.round(pct))}% OFF` : 'Oferta';
	}

	function precioEnOferta() {
		const precio = Number(producto?.precio ?? 0);
		const precioDescuento = Number(producto?.precioDescuento ?? 0);
		return precioDescuento > 0 && precioDescuento < precio ? precioDescuento : null;
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

	function handleAdd(e) {
		e.stopPropagation();
		if (tieneVariantes() && browser) {
			window.location.href = resolve(`/producto/${producto.id}`);
			return;
		}

		agregarAlCarrito(producto);
		added = true;
		setTimeout(() => (added = false), 1200);
	}
</script>

<article class="card">
	<a
		class="card-link"
		href={resolve(`/producto/${producto.id}`)}
		aria-label={`Ver ${producto.nombre}`}
		onclick={() => registrarProductoVisto(producto.id)}
	>
		<div class="img-wrapper">
			{#if producto.oferta}
				<span class="badge-oferta">{getDescuentoTexto()}</span>
			{/if}
			<img src={producto.imagen} alt={producto.nombre} loading="lazy" />
		</div>

		<div class="content">
			<h3 class="nombre">{producto.nombre}</h3>
			{#if precioEnOferta()}
				<p class="precio">${Number(precioEnOferta()).toLocaleString('es-CL')}</p>
				<p class="precio-original">${Number(producto.precio).toLocaleString('es-CL')}</p>
			{:else}
				<p class="precio">${producto.precio.toLocaleString('es-CL')}</p>
			{/if}
			<p class="desc">{producto.descripcion}</p>
		</div>
	</a>

	<div class="actions">
		<button
			class="btn-agregar"
			onclick={handleAdd}
			aria-label={tieneVariantes()
				? `Ver medidas de ${producto.nombre}`
				: `Agregar ${producto.nombre} al carrito`}
			type="button"
		>
			{tieneVariantes() ? 'Ver medidas' : 'Agregar'}
		</button>

		{#if added}
			<span class="toast" role="status" aria-live="polite">Agregado</span>
		{/if}
	</div>
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1rem;
		border-radius: 18px;
		border: 1px solid var(--color-border-soft);
		background: var(--color-surface);
		box-shadow: var(--shadow-sm);
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			border-color 0.15s ease;
		user-select: none;
	}

	.card-link {
		display: block;
		color: inherit;
		text-decoration: none;
	}

	.card:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-soft);
		border-color: var(--color-primary);
	}

	.card:focus-within {
		box-shadow: 0 0 0 4px var(--vgv-shadow-primary);
	}

	.img-wrapper {
		width: 100%;
		height: 180px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-surface-tint), var(--color-surface-tint-2));
		border-radius: 14px;
		overflow: hidden;
		position: relative;
	}

	.badge-oferta {
		position: absolute;
		top: 0.55rem;
		left: 0.55rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: var(--color-warning-bg);
		color: var(--color-warning-text);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.nombre {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
		margin: 0;
	}

	.precio {
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--vgv-verde);
		margin: 0;
	}

	.precio-original {
		margin: -0.15rem 0 0;
		color: var(--vgv-gris);
		font-size: 0.9rem;
		text-decoration: line-through;
	}

	.desc {
		color: var(--vgv-gris);
		font-size: 0.9rem;
		margin: 0;
		line-height: 1.4;
	}

	.actions {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		margin-top: 0.2rem;
	}

	.btn-agregar {
		background: linear-gradient(135deg, var(--vgv-azul), var(--vgv-azul-oscuro));
		color: var(--vgv-blanco);
		padding: 0.6rem 1rem;
		border: none;
		border-radius: 999px;
		font-weight: 700;
		cursor: pointer;
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
		box-shadow: 0 8px 18px var(--vgv-shadow-primary-soft);
	}

	.btn-agregar:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 20px var(--vgv-shadow-primary-strong);
	}

	.btn-agregar:active {
		transform: scale(0.97);
	}

	.toast {
		color: var(--vgv-verde-oscuro);
		font-weight: 700;
		font-size: 0.95rem;
		animation: popIn 0.35s ease;
	}

	@keyframes popIn {
		0% {
			opacity: 0;
			transform: translateY(4px) scale(0.96);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@media (max-width: 600px) {
		.img-wrapper {
			height: 140px;
		}
	}
</style>
