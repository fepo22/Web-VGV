<script>
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { backendUrl } from '$lib/utils/backend-url.js';

	const STORAGE_KEY = 'vgv_admin_token';

	let username = $state('admin');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	onMount(() => {
		if (!browser) return;

		if (localStorage.getItem(STORAGE_KEY)) {
			goto(resolve('/admin/dashboard'));
		}
	});

	function storeToken(token) {
		if (!browser) return;
		localStorage.setItem(STORAGE_KEY, token);
	}

	async function login(event) {
		event.preventDefault();
		loading = true;
		error = '';

		try {
			const response = await fetch(backendUrl('/auth/login'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			const data = await response.json().catch(() => ({}));

			if (!response.ok || !data?.token) {
				throw new Error(data?.error || 'No se pudo iniciar sesión.');
			}

			storeToken(data.token);
			goto(resolve('/admin/dashboard'));
		} catch (loginError) {
			error = loginError instanceof Error ? loginError.message : 'Error inesperado.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Acceso administrativo VGV</title>
</svelte:head>

<section class="login-shell">
	<div class="login-card card">
		<div>
			<p class="eyebrow">Acceso administrativo</p>
			<h1>Iniciar sesión</h1>
			<p>Ingresa con tus credenciales para administrar productos en el panel protegido.</p>
		</div>

		<form class="login-form" onsubmit={login}>
			<label>
				Usuario
				<input bind:value={username} type="text" autocomplete="username" required />
			</label>

			<label>
				Contraseña
				<input bind:value={password} type="password" autocomplete="current-password" required />
			</label>

			{#if error}
				<p class="feedback error">{error}</p>
			{/if}

			<button class="submit" type="submit" disabled={loading}>
				{loading ? 'Ingresando...' : 'Entrar'}
			</button>
		</form>
	</div>
</section>

<style>
	.login-shell {
		min-height: calc(100vh - 8rem);
		display: grid;
		place-items: center;
		padding: 2rem 1rem 3rem;
		background:
			radial-gradient(circle at top left, rgba(13, 71, 161, 0.12), transparent 34%),
			radial-gradient(circle at bottom right, rgba(46, 125, 50, 0.1), transparent 30%);
	}

	.login-card {
		width: min(100%, 520px);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--vgv-verde);
	}

	h1 {
		margin: 0;
		color: var(--vgv-azul-oscuro);
	}

	p {
		margin: 0.4rem 0 0;
		color: var(--vgv-gris);
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
	}

	input {
		width: 100%;
	}

	.submit {
		border: none;
		border-radius: 999px;
		padding: 0.9rem 1.2rem;
		font-weight: 800;
		cursor: pointer;
		background: var(--vgv-verde);
		color: var(--vgv-blanco);
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			opacity 0.15s ease;
	}

	.submit:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: var(--vgv-shadow-md);
	}

	.submit:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	.feedback {
		margin: 0;
		padding: 0.85rem 1rem;
		border-radius: 12px;
		font-weight: 700;
	}

	.feedback.error {
		background: rgba(216, 64, 64, 0.1);
		color: var(--vgv-danger);
	}

	@media (max-width: 700px) {
		.login-shell {
			min-height: auto;
		}
	}
</style>
