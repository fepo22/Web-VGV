<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy } from 'svelte';
	import { carrito } from '$lib/stores/carrito.js';
	const { titulo = 'Catálogo VGV', admin = false } = $props();

	const STORAGE_KEY = 'vgv_admin_token';

	let itemsCount = $state(0);
	let pulse = $state(false);

	const unsubscribe = carrito.subscribe((value) => {
		itemsCount = value.reduce((total, item) => total + (item.cantidad || 1), 0);
	});
	onDestroy(unsubscribe);

	$effect(() => {
		if (!browser) return;
		if (itemsCount > 0) {
			pulse = true;
			const timer = window.setTimeout(() => (pulse = false), 500);
			return () => window.clearTimeout(timer);
		}
	});

	function getVgvHomeUrl() {
		const configured = (import.meta.env.VITE_VGV_HOME_URL || '').trim();
		if (configured) return configured;

		const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
		if (isLocal) return 'http://localhost:3000/index.html';

		return 'https://www.vgv.cl/index.html';
	}

	function volverAlInicio() {
		if (!browser) return;
		window.location.href = getVgvHomeUrl();
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
			<a href={resolve('/catalogo?linea=todas&ofertas=1')}>Ofertas</a>
			<a href={resolve('/catalogo')}>Catálogo</a>
			<a class="cart-link" href={resolve('/carrito')}>
				Carrito
				<span
					class={`cart-count ${pulse ? 'pulse' : ''}`}
					aria-label={`${itemsCount} productos en el carrito`}
				>
					{itemsCount}
				</span>
			</a>
		{/if}
	</div>
</nav>

<style>
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
