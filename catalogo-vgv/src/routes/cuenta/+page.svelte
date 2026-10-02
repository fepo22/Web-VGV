<script>
	import { onMount } from 'svelte';
	import { backendUrl } from '$lib/utils/backend-url.js';

	const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
	const statusLabels = {
		pendiente: 'Pendiente',
		cotizacion_enviada: 'Cotización enviada',
		confirmada: 'Confirmada',
		completada: 'Completada',
		desistida: 'Desistida'
	};
	let mode = $state('login');
	let customer = $state(null);
	let quotes = $state([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let notice = $state('');
	let email = $state('');
	let password = $state('');
	let resetToken = $state('');
	let profile = $state({
		tipoCliente: '', nombre: '', empresa: '', rut: '', direccionComercial: '',
		direccionDespacho: '', telefono: ''
	});
	let googleReady = $state(false);
	let googleContainer = $state();
	let renderedGoogleContainer;

	async function request(path, method = 'GET', body) {
		const response = await fetch(backendUrl(`/api/clientes${path}`), {
			method,
			credentials: 'include',
			...(body ? { headers: { 'content-type': 'application/json' } } : {}),
			...(body ? { body: JSON.stringify(body) } : {})
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
		return data;
	}

	function setCustomer(value) {
		customer = value;
		if (value) {
			email = value.email;
			profile = {
				tipoCliente: value.tipoCliente || '', nombre: value.nombre || '',
				empresa: value.empresa || '', rut: value.rut || '',
				direccionComercial: value.direccionComercial || '',
				direccionDespacho: value.direccionDespacho || '', telefono: value.telefono || ''
			};
			if (value.profileComplete) void loadQuotes();
		}
	}

	async function loadQuotes() {
		try {
			quotes = await request('/cotizaciones');
		} catch (loadError) {
			error = loadError.message;
		}
	}

	async function submit(path, body, success) {
		saving = true;
		error = '';
		notice = '';
		try {
			const data = await request(path, 'POST', body);
			if (data.customer) setCustomer(data.customer);
			if (success) success(data);
			else notice = data.message || 'Solicitud recibida.';
		} catch (submitError) {
			error = submitError.message;
		} finally {
			saving = false;
		}
	}

	function submitLogin(event) {
		event.preventDefault();
		void submit('/ingresar', { email, password }, () => { password = ''; });
	}

	function submitRegister(event) {
		event.preventDefault();
		void submit('/registrar', { ...profile, email, password }, (data) => {
			mode = 'login';
			password = '';
			notice = data.message;
		});
	}

	async function submitProfile(event) {
		event.preventDefault();
		saving = true;
		error = '';
		try {
			const data = await request('/mi-perfil', 'PUT', profile);
			setCustomer(data.customer);
			notice = 'Perfil actualizado.';
		} catch (saveError) {
			error = saveError.message;
		} finally {
			saving = false;
		}
	}

	async function logout() {
		await request('/salir', 'POST');
		customer = null;
		quotes = [];
		mode = 'login';
	}

	async function handleGoogle(credential) {
		await submit(customer ? '/vincular-google' : '/google', { credential }, (data) => {
			if (data.customer) setCustomer(data.customer);
		});
	}

	$effect(() => {
		if (!googleReady || !googleContainer || !window.google || renderedGoogleContainer === googleContainer) return;
		renderedGoogleContainer = googleContainer;
		window.google.accounts.id.initialize({
			client_id: googleClientId,
			callback: ({ credential }) => void handleGoogle(credential)
		});
		window.google.accounts.id.renderButton(googleContainer, { theme: 'outline', size: 'large', text: customer ? 'continue_with' : 'signin_with' });
	});

	onMount(() => {
		const fragment = new URLSearchParams(window.location.hash.slice(1));
		const verifyToken = fragment.get('verificar');
		resetToken = fragment.get('restablecer') || '';
		if (verifyToken || resetToken) window.history.replaceState({}, '', window.location.pathname);
		if (resetToken) mode = 'reset';
		if (!resetToken) {
			void request('/mi-perfil').then((data) => setCustomer(data.customer)).catch(() => {}).finally(() => { loading = false; });
		} else loading = false;
		if (verifyToken) void submit('/verificar', { token: verifyToken }, () => { notice = 'Correo verificado. Tu cuenta está activa.'; });
		if (googleClientId) {
			const script = document.createElement('script');
			script.src = 'https://accounts.google.com/gsi/client';
			script.async = true;
			script.onload = () => { googleReady = true; };
			document.head.appendChild(script);
		}
	});
</script>

<svelte:head><title>Mi cuenta | VGV</title></svelte:head>

<section class="account">
	<header class="account-header">
		<div><p class="eyebrow">VGV</p><h1>Mi cuenta</h1></div>
		{#if customer}<button type="button" onclick={logout}>Cerrar sesión</button>{/if}
	</header>
	{#if error}<p class="feedback error" role="alert">{error}</p>{/if}
	{#if notice}<p class="feedback success" role="status">{notice}</p>{/if}
	{#if loading}
		<p>Consultando tu cuenta...</p>
	{:else if !customer}
		{#if mode === 'reset'}
			<form class="account-form" onsubmit={(event) => { event.preventDefault(); void submit('/restablecer', { token: resetToken, password }, () => { mode = 'login'; password = ''; notice = 'Contraseña actualizada. Ya puedes ingresar.'; }); }}>
				<h2>Nueva contraseña</h2>
				<label>Contraseña nueva <input type="password" autocomplete="new-password" minlength="12" bind:value={password} required /></label>
				<button type="submit" disabled={saving}>Guardar contraseña</button>
			</form>
		{:else}
			<div class="tabs" role="tablist" aria-label="Acceso a cuenta">
				<button type="button" role="tab" aria-selected={mode === 'login'} class:active={mode === 'login'} onclick={() => { mode = 'login'; error = ''; }}>Ingresar</button>
				<button type="button" role="tab" aria-selected={mode === 'register'} class:active={mode === 'register'} onclick={() => { mode = 'register'; error = ''; }}>Crear cuenta</button>
			</div>
			{#if mode === 'recover'}
				<form class="account-form" onsubmit={(event) => { event.preventDefault(); void submit('/recuperar', { email }); }}>
					<h2>Recuperar acceso</h2>
					<label>Email <input type="email" autocomplete="email" bind:value={email} required /></label>
					<button type="submit" disabled={saving}>Enviar enlace</button>
					<button class="text-button" type="button" onclick={() => mode = 'login'}>Volver al ingreso</button>
				</form>
			{:else}
				<form class="account-form" onsubmit={mode === 'register' ? submitRegister : submitLogin}>
					<h2>{mode === 'register' ? 'Crear cuenta' : 'Ingresar'}</h2>
					<label>Email <input type="email" autocomplete="email" bind:value={email} required /></label>
					<label>Contraseña <input type="password" autocomplete={mode === 'register' ? 'new-password' : 'current-password'} minlength={mode === 'register' ? 12 : undefined} bind:value={password} required /></label>
					{#if mode === 'register'}
						{@render profileFields()}
					{/if}
					<button type="submit" disabled={saving}>{mode === 'register' ? 'Crear cuenta' : 'Ingresar'}</button>
				</form>
				{#if mode === 'login'}
					<div class="account-links">
						<button class="text-button" type="button" onclick={() => mode = 'recover'}>Olvidé mi contraseña</button>
						<button class="text-button" type="button" onclick={() => void submit('/reenviar', { email })}>Reenviar verificación</button>
					</div>
				{/if}
			{/if}
			{#if googleClientId && mode !== 'recover'}<div class="google-button" bind:this={googleContainer}></div>{/if}
		{/if}
	{:else if !customer.profileComplete}
		<form class="account-form" onsubmit={submitProfile}>
			<h2>Completa tu perfil</h2>
			{@render profileFields()}
			<button type="submit" disabled={saving}>Guardar perfil</button>
		</form>
	{:else}
		<div class="profile-header">
			<div><h2>{customer.nombre}</h2><p>{customer.email} · {customer.telefono}</p></div>
			<button type="button" onclick={() => mode = mode === 'profile' ? 'history' : 'profile'}>{mode === 'profile' ? 'Ver historial' : 'Editar perfil'}</button>
		</div>
		{#if mode === 'profile'}
			<form class="account-form" onsubmit={submitProfile}>
				{@render profileFields()}
				<button type="submit" disabled={saving}>Guardar cambios</button>
			</form>
			{#if googleClientId && !customer.googleConnected}<div class="google-button" bind:this={googleContainer}></div>{/if}
		{:else}
			<h2>Mis cotizaciones</h2>
			{#if quotes.length === 0}<p>Todavía no tienes cotizaciones registradas con este correo.</p>{/if}
			<div class="quotes">
				{#each quotes as quote (quote._id)}
					<details class="quote">
						<summary><strong>{new Date(quote.createdAt).toLocaleDateString('es-CL')}</strong><span class="state">{statusLabels[quote.estado] || statusLabels.pendiente}</span><span>{quote.productos?.length || 0} productos</span></summary>
						<ul>{#each quote.productos || [] as product, position (position)}<li>{product.nombre} · {product.varianteSku || product.id} × {product.cantidad}</li>{/each}</ul>
						{#if quote.historialEstados?.length}<p>Última actualización: {new Date(quote.updatedAt).toLocaleString('es-CL')}</p>{/if}
					</details>
				{/each}
			</div>
		{/if}
	{/if}
</section>

{#snippet profileFields()}
	<div class="fields">
		<label>Tipo de cliente
			<select bind:value={profile.tipoCliente} required>
				<option value="" disabled>Selecciona una opción</option>
				<option value="constructora">Constructora</option>
				<option value="instalador/contratista/arquitecto">Instalador / contratista / arquitecto</option>
				<option value="particular">Particular</option>
			</select>
		</label>
		<label>Nombre y apellido <input bind:value={profile.nombre} autocomplete="name" required minlength="3" /></label>
		{#if profile.tipoCliente !== 'particular'}
			<label>Empresa {profile.tipoCliente === 'constructora' ? '' : '(opcional)'}
				<input bind:value={profile.empresa} required={profile.tipoCliente === 'constructora'} />
			</label>
		{/if}
		<label>{profile.tipoCliente === 'constructora' ? 'RUT de empresa' : 'RUT personal o de empresa'} <input bind:value={profile.rut} required /></label>
		<label>{profile.tipoCliente === 'particular' ? 'Dirección de contacto' : 'Dirección comercial'} <input bind:value={profile.direccionComercial} autocomplete="street-address" required /></label>
		<label>Dirección de despacho <input bind:value={profile.direccionDespacho} required /></label>
		<label>Teléfono de contacto <input type="tel" bind:value={profile.telefono} autocomplete="tel" required /></label>
	</div>
{/snippet}

<style>
	.account { max-width: 900px; margin: 0 auto; padding: 1rem 0 3rem; color: var(--vgv-azul-oscuro); }
	.account-header, .profile-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--vgv-border-soft); padding-bottom: 1rem; overflow-wrap: anywhere; }
	.account-header h1 { margin: 0; font-size: 1.8rem; }
	.eyebrow { margin: 0 0 0.25rem; color: var(--vgv-verde); font-weight: 700; }
	h2 { margin: 1.2rem 0 0.7rem; font-size: 1.25rem; }
	.tabs { display: flex; border-bottom: 1px solid var(--vgv-border-soft); margin: 1rem 0; }
	.tabs button { background: transparent; color: inherit; border: 0; border-bottom: 3px solid transparent; padding: 0.7rem 1rem; cursor: pointer; }
	.tabs button.active { border-color: var(--vgv-verde); font-weight: 700; }
	.account-form { max-width: 650px; padding: 0.6rem 0; }
	.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; margin: 1rem 0; }
	label { display: grid; gap: 0.35rem; margin: 0.7rem 0; font-weight: 600; }
	input, select { width: 100%; min-width: 0; padding: 0.7rem; border: 1px solid var(--vgv-border-soft); border-radius: 4px; font: inherit; }
	button { font: inherit; cursor: pointer; }
	.account-form > button[type='submit'], .account-header button, .profile-header button { border: 0; background: var(--vgv-azul); color: white; padding: 0.7rem 1.1rem; border-radius: 4px; font-weight: 700; }
	button:disabled { opacity: 0.6; cursor: wait; }
	.account-links { display: flex; flex-wrap: wrap; gap: 1rem; }
	.text-button { border: 0; background: none; color: var(--vgv-azul); padding: 0.4rem 0; text-decoration: underline; }
	.google-button { margin: 1rem 0; min-height: 42px; }
	.feedback { padding: 0.8rem; border-radius: 4px; margin: 1rem 0; }
	.feedback.error { color: #9f1d1d; background: #fff1f1; }
	.feedback.success { color: #14532d; background: #ecfdf3; }
	.quotes { display: grid; gap: 0.7rem; }
	.quote { border: 1px solid var(--vgv-border-soft); border-radius: 4px; padding: 0.8rem 1rem; }
	.quote summary { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; cursor: pointer; }
	.quote summary strong { min-width: 8rem; }
	.state { color: var(--vgv-verde-oscuro); font-weight: 700; }
	.quote li { margin: 0.4rem 0; }
	@media (max-width: 650px) { .fields { grid-template-columns: 1fr; } .account-header, .profile-header { flex-direction: column; align-items: flex-start; } }
</style>