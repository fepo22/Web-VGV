<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy, tick } from 'svelte';
	import { carrito, carritoLateralAbierto, eliminarDelCarrito } from '$lib/stores/carrito.js';
	const { titulo = 'Catálogo VGV', admin = false } = $props();

	const STORAGE_KEY = 'vgv_admin_token';

	let itemsCount = $state(0);
	let items = $state([]);
	let panelAbierto = $state(false);
	let panelElement = $state();
	let pulse = $state(false);

	const unsubscribe = carrito.subscribe((value) => {
		items = value;
		itemsCount = value.reduce((total, item) => total + (item.cantidad || 1), 0);
	});
	onDestroy(unsubscribe);
	const unsubscribePanel = carritoLateralAbierto.subscribe((value) => (panelAbierto = value));
	onDestroy(unsubscribePanel);

	function cerrarPanel() {
		carritoLateralAbierto.set(false);
	}

	$effect(() => {
		if (panelAbierto) tick().then(() => panelElement?.focus());
	});

	$effect(() => {
		if (!browser) return;
		if (itemsCount > 0) {
			pulse = true;
			const timer = window.setTimeout(() => (pulse = false), 500);
			return () => window.clearTimeout(timer);
		}
	});

	async function volverAlInicio() {
		if (!browser) return;
		await goto(resolve('/'));
	}

	async function cerrarSesionAdmin() {
		if (!browser) return;
		localStorage.removeItem(STORAGE_KEY);
		await goto(resolve('/admin/login'));
	}
</script>

<nav class="nav">
	<div class="logo">{titulo}</div>

	<div class="links">
		{#if admin}
			<a href={resolve('/admin/dashboard')}>Dashboard</a>
			<a href={resolve('/catalogo')}>Ver catálogo</a>
			<button class="link-btn" type="button" onclick={cerrarSesionAdmin}>Cerrar sesión</button>
		{:else}
			<button class="link-btn" type="button" onclick={volverAlInicio}>Volver al inicio</button>
			<a href={resolve('/catalogo')}>Catálogo</a>
			<button class="cart-link link-btn" type="button" onclick={() => carritoLateralAbierto.set(true)} aria-label="Ver carrito">
				Carrito
				<span
					class={`cart-count ${pulse ? 'pulse' : ''}`}
					aria-label={`${itemsCount} productos en el carrito`}
				>
					{itemsCount}
				</span>
			</button>
		{/if}
	</div>
</nav>

<svelte:window onkeydown={(event) => panelAbierto && event.key === 'Escape' && cerrarPanel()} />
{#if !admin && panelAbierto}
	<button class="panel-backdrop" type="button" aria-label="Cerrar carrito" onclick={cerrarPanel}></button>
	<div bind:this={panelElement} class="cart-panel" role="dialog" aria-modal="true" aria-label="Carrito de compras" tabindex="-1">
		<div class="panel-header">
			<h2>Tu carrito ({itemsCount})</h2>
			<button class="close-panel" type="button" aria-label="Cerrar carrito" onclick={cerrarPanel}>×</button>
		</div>
		{#if items.length === 0}
			<p>Tu carrito está vacío.</p>
		{:else}
			<ul class="panel-items">
				{#each items as item (item.cartKey)}
					<li>
						<img src={item.imagen} alt="" width="64" height="64" />
						<div><strong>{item.nombre}</strong><span>Cantidad: {item.cantidad}</span></div>
						<button type="button" aria-label={`Eliminar ${item.nombre}`} onclick={() => eliminarDelCarrito(item.cartKey)}>×</button>
					</li>
				{/each}
			</ul>
			<div class="panel-actions">
				<a href={resolve('/carrito')} onclick={cerrarPanel}>Ver carrito</a>
				<a href={resolve('/checkout')} onclick={cerrarPanel}>Solicitar cotización</a>
			</div>
		{/if}
	</div>
{/if}

<style>
	.panel-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1100;
		background: rgba(0, 0, 0, 0.42);
		border: 0;
		cursor: pointer;
	}

	.cart-panel {
		position: fixed;
		inset: 0 0 0 auto;
		z-index: 1101;
		width: min(100%, 420px);
		background: white;
		color: var(--vgv-azul-oscuro);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		box-shadow: -8px 0 30px rgba(0, 0, 0, 0.18);
	}

	.panel-header, .panel-items li, .panel-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.panel-header h2 { margin: 0; font-size: 1.25rem; }
	.close-panel, .panel-items button { background: none; border: 0; font-size: 1.5rem; cursor: pointer; }
	.panel-items { list-style: none; padding: 0; overflow-y: auto; flex: 1; }
	.panel-items li { border-bottom: 1px solid #d9e5f2; padding: 0.8rem 0; }
	.panel-items img { object-fit: contain; flex: none; }
	.panel-items li div { flex: 1; display: grid; gap: 0.25rem; }
	.panel-items span { font-size: 0.85rem; }
	.panel-actions { margin-top: auto; padding-top: 1rem; flex-wrap: wrap; }
	.panel-actions a { color: var(--vgv-azul-oscuro); font-weight: 700; }

	.nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: var(--vgv-azul-oscuro);
		color: var(--vgv-blanco);
	}

	.logo {
		font-size: 1.3rem;
		font-weight: bold;
	}

	.links a {
		margin-left: 1.5rem;
		color: var(--vgv-blanco);
		text-decoration: none;
		font-weight: 600;
	}

	.cart-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.cart-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.35rem;
		height: 1.35rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--vgv-verde);
		color: var(--vgv-blanco);
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.cart-count.pulse {
		transform: scale(1.14);
		box-shadow: 0 0 0 4px var(--vgv-overlay-soft);
	}

	.link-btn {
		margin-left: 1.5rem;
		background: transparent;
		border: 1px solid var(--vgv-overlay-muted);
		color: var(--vgv-blanco);
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		font-weight: 600;
		cursor: pointer;
	}

	.link-btn:hover {
		color: var(--vgv-verde);
		border-color: var(--vgv-verde);
	}

	.links a:hover {
		color: var(--vgv-verde);
	}

	@media (max-width: 700px) {
		.nav {
			flex-direction: column;
			gap: 0.75rem;
			align-items: flex-start;
		}

		.links {
			display: flex;
			flex-wrap: wrap;
			gap: 0.6rem;
		}

		.links a,
		.link-btn {
			margin-left: 0;
		}
	}
</style>
