<script>
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';

	function createToken() {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	let nombre = $state('');
	let correo = $state('');
	let mensaje = $state('');
	let empresa = $state('');
	let token = $state(createToken());
	let loading = $state(false);
	let formStatus = $state('');
	let formStatusType = $state('');
	let errorNombre = $state('');
	let errorCorreo = $state('');
	let errorMensaje = $state('');
	let toast = $state('');
	let toastType = $state('');
	let toastTimer;

	$effect(() => {
		if (!toast) return;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toast = '';
			toastType = '';
		}, 3600);
	});

	onDestroy(() => {
		clearTimeout(toastTimer);
	});

	function normalizeName(value) {
		return String(value ?? '')
			.replace(/\s+/g, ' ')
			.trim()
			.split(' ')
			.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
			.join(' ');
	}

	function sanitize(value) {
		return String(value ?? '').replace(/[<>]/g, '');
	}

	function validate() {
		errorNombre = '';
		errorCorreo = '';
		errorMensaje = '';

		const safeNombre = normalizeName(sanitize(nombre));
		const safeCorreo = sanitize(correo).trim();
		const safeMensaje = sanitize(mensaje).trim();

		if (safeNombre.length < 3) errorNombre = 'Ingresa al menos 3 caracteres.';
		if (safeNombre.length > 100) errorNombre = 'El nombre no puede superar 100 caracteres.';
		if (!safeCorreo) errorCorreo = 'El correo es obligatorio.';
		else if (!emailRegex.test(safeCorreo)) errorCorreo = 'Ingresa un correo valido.';
		if (safeMensaje.length < 10) errorMensaje = 'El mensaje debe tener al menos 10 caracteres.';
		if (safeMensaje.length > 2000) errorMensaje = 'El mensaje no puede superar 2000 caracteres.';

		nombre = safeNombre;
		correo = safeCorreo;
		mensaje = safeMensaje;

		return !errorNombre && !errorCorreo && !errorMensaje;
	}

	async function submitForm(event) {
		event.preventDefault();
		formStatus = '';
		formStatusType = '';

		if (!validate()) {
			formStatus = 'Revisa los campos marcados antes de enviar.';
			formStatusType = 'error';
			toast = 'Revisa los campos marcados para continuar.';
			toastType = 'error';
			return;
		}

		loading = true;
		formStatus = 'Enviando tu mensaje...';
		formStatusType = 'info';

		try {
			const response = await fetch('/api/contacto', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ nombre, correo, mensaje, empresa, token })
			});

			const data = await response.json().catch(() => ({}));
			if (response.ok && data?.ok) {
				formStatus = 'Mensaje enviado correctamente. Te responderemos pronto.';
				formStatusType = 'success';
				toast = 'Gracias, tu mensaje fue enviado correctamente.';
				toastType = 'success';
				nombre = '';
				correo = '';
				mensaje = '';
				empresa = '';
				token = createToken();
			} else {
				const detail = data?.detail || data?.error || 'Hubo un error al enviar el mensaje.';
				formStatus = `Error: ${detail}`;
				formStatusType = 'error';
				toast = `Error: ${detail}`;
				toastType = 'error';
			}
		} catch {
			formStatus =
				'No se pudo enviar el mensaje. Verifica que el backend esté corriendo en puerto 3000.';
			formStatusType = 'error';
			toast = 'Sin conexión con API. Levanta Backend en localhost:3000.';
			toastType = 'error';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Contacto | VGV SPA</title>
	<meta
		name="description"
		content="Contáctanos por correo, teléfono o WhatsApp para cotizaciones rápidas. Atención personalizada en Talcahuano."
	/>
	<link rel="canonical" href="https://www.vgv.cl/contacto" />
	<link rel="stylesheet" href="/style/base.css" />
	<link rel="stylesheet" href="/style/layout.css" />
	<link rel="stylesheet" href="/style/utils.css" />
	<link rel="stylesheet" href="/style/contacto.css" />
</svelte:head>

<header>
	<nav class="container">
		<div class="logo">
			<a href={resolve('/')}>
				<img src="/assets/Logo-preview.png" alt="Logo VGV SPA" />
			</a>
		</div>
		<ul>
			<li><a href={resolve('/catalogo?linea=todas&ofertas=1')}>Ofertas</a></li>
			<li><a href={resolve('/catalogo')}>Catálogo</a></li>
			<li><a href={resolve('/catalogo')}>Quiénes somos</a></li>
			<li><a href={resolve('/contacto')} class="active">Contacto</a></li>
		</ul>
	</nav>
</header>

<section class="contacto-hero">
	<h1>Contáctanos</h1>
	<p>Estamos disponibles para atender tus consultas y cotizaciones.</p>
</section>

<section class="contacto-container">
	<h2>Comunícate con nosotros</h2>
	<div class="contacto-grid">
		<div class="contact-card">
			<h3>Correo electrónico</h3>
			<p>Envíanos tus consultas o cotizaciones directamente por correo.</p>
			<a href="mailto:ventas@vgv.cl" class="btn-contacto">Enviar correo</a>
		</div>
		<div class="contact-card">
			<h3>WhatsApp</h3>
			<p>Escríbenos directamente para cotizaciones rápidas.</p>
			<a href="https://wa.me/56934052194" class="btn-contacto">Abrir WhatsApp</a>
		</div>
	</div>
</section>

<section class="contacto-wrapper container">
	<form id="form-contacto" class="contacto-form" novalidate onsubmit={submitForm}>
		<h2>Envíanos un mensaje</h2>
		<p class="form-intro">Completa tus datos y te responderemos dentro de 24 horas hábiles.</p>

		<input type="text" id="empresa" name="empresa" bind:value={empresa} style="display:none" />
		<input type="hidden" id="token" name="token" bind:value={token} />

		<div class="form-group">
			<label for="nombre">Nombre</label>
			<input
				id="nombre"
				name="nombre"
				type="text"
				autocomplete="name"
				minlength="3"
				maxlength="100"
				bind:value={nombre}
				required
				class:input-error={Boolean(errorNombre)}
				aria-describedby="error-nombre"
			/>
			<small id="error-nombre" class="field-error" aria-live="polite">{errorNombre}</small>
		</div>

		<div class="form-group">
			<label for="correo">Correo</label>
			<input
				id="correo"
				name="correo"
				type="email"
				autocomplete="email"
				bind:value={correo}
				required
				class:input-error={Boolean(errorCorreo)}
				aria-describedby="error-correo"
			/>
			<small id="error-correo" class="field-error" aria-live="polite">{errorCorreo}</small>
		</div>

		<div class="floating">
			<textarea
				id="mensaje"
				name="mensaje"
				placeholder=" "
				minlength="10"
				maxlength="2000"
				bind:value={mensaje}
				required
				class:input-error={Boolean(errorMensaje)}
				aria-describedby="error-mensaje contador-mensaje"
			></textarea>
			<label for="mensaje">Mensaje</label>
			<small id="error-mensaje" class="field-error" aria-live="polite">{errorMensaje}</small>
			<small id="contador-mensaje" class="char-counter" aria-live="polite"
				>{mensaje.trim().length} / 2000</small
			>
		</div>

		<button type="submit" class="btn-enviar" id="btn-enviar-contacto" disabled={loading}>
			{loading ? 'Enviando...' : 'Enviar'}
		</button>
		<p
			id="form-status"
			class={`form-status ${formStatusType ? `is-${formStatusType}` : ''}`}
			role="status"
			aria-live="polite"
		>
			{formStatus}
		</p>
	</form>

	<div class="contacto-mapa">
		<h2>Ubicación</h2>
		<div class="map-container">
			<iframe
				width="100%"
				height="100%"
				style="border:0"
				title="Ubicación de VGV SPA en Talcahuano"
				loading="lazy"
				allowfullscreen
				referrerpolicy="no-referrer-when-downgrade"
				src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323.497308353788!2d-73.116948!3d-36.777650!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9669b5c1b6c3b4e3%3A0x7f1b8c1a3f9f0b7!2sAlonso%20de%20Ojeda%20215%2C%20Talcahuano%2C%20Biob%C3%ADo!5e0!3m2!1ses!2scl!4v1716400000000"
			></iframe>
		</div>
	</div>
</section>

<footer>
	<p>© 2016 VGV SPA — Comercializadora y distribuidora, Talcahuano</p>
</footer>

<div
	id="toast-contacto"
	class={`toast-contacto ${toastType ? `toast-${toastType}` : ''} ${toast ? 'show' : ''}`}
	role="status"
	aria-live="polite"
	aria-atomic="true"
>
	{toast}
</div>
