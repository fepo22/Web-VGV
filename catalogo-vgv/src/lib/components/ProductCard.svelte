<script>
	import { resolve } from '$app/paths';
	import { agregarAlCarrito } from '$lib/stores/carrito.js';

	const { producto } = $props();
	let added = $state(false);

	function handleAdd(e) {
		e.stopPropagation();
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
	>
		<div class="img-wrapper">
			<img src={producto.imagen} alt={producto.nombre} loading="lazy" />
		</div>

		<div class="content">
			<h3 class="nombre">{producto.nombre}</h3>
			<p class="precio">${producto.precio.toLocaleString('es-CL')}</p>
			<p class="desc">{producto.descripcion}</p>
		</div>
	</a>

	<div class="actions">
		<button
			class="btn-agregar"
			onclick={handleAdd}
			aria-label={`Agregar ${producto.nombre} al carrito`}
			type="button"
		>
			Agregar
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
		border: 1px solid #e7eef6;
		background: var(--vgv-blanco);
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
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
		box-shadow: 0 14px 32px rgba(0, 87, 160, 0.12);
		border-color: var(--vgv-azul);
	}

	.card:focus-within {
		box-shadow: 0 0 0 4px rgba(0, 87, 160, 0.08);
	}

	.img-wrapper {
		width: 100%;
		height: 180px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #f8fbff, #eef5fb);
		border-radius: 14px;
		overflow: hidden;
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
		box-shadow: 0 8px 18px rgba(0, 87, 160, 0.16);
	}

	.btn-agregar:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 20px rgba(0, 87, 160, 0.22);
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
