<script>
	import { carrito } from '$lib/stores/carrito.js';

	let items = $state([]);
	let enviado = $state(false);
	let enviando = $state(false);
	let errorEnvio = $state('');
	let formValues = $state({
		nombreApellido: '',
		empresa: '',
		rut: '',
		direccion: '',
		contacto: '',
		mail: ''
	});

	const datosBancarios = {
		banco: 'BCI Credito e inversiones',
		tipoCuenta: 'Cuenta corriente',
		numeroCuenta: '78384578',
		rut: '76.420.074-8',
		razonSocial: 'Comercial y distribuidora VGV SPA',
		correo: 'ventas@vgv.cl'
	};

	$effect(() => {
		const unsub = carrito.subscribe((value) => {
			items = value;
		});

		return () => unsub();
	});

	function total() {
		return items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
	}

	async function enviarFormulario(event) {
		event.preventDefault();
		const form = event.currentTarget;
		enviado = false;
		errorEnvio = '';
		enviando = true;

		const formData = new FormData(event.currentTarget);
		const nombre = String(formData.get('nombreApellido') || '').trim();
		const empresa = String(formData.get('empresa') || '').trim();
		const correo = String(formData.get('mail') || '').trim();
		const contacto = String(formData.get('contacto') || '').trim();
		const rut = String(formData.get('rut') || '').trim();
		const direccion = String(formData.get('direccion') || '').trim();

		if (!nombre || !empresa || !correo || !contacto || !rut || !direccion) {
			errorEnvio = 'Completa todos los campos antes de enviar la solicitud.';
			enviando = false;
			return;
		}

		const detalle = items
			.map(
				(item) =>
					`- ${item.nombre} x ${item.cantidad} ($${(item.precio * item.cantidad).toLocaleString('es-CL')})`
			)
			.join('\n');

		const mensaje = [
			'Solicitud de compra desde checkout VGV',
			`Cliente: ${nombre}`,
			`Empresa: ${empresa}`,
			`RUT: ${rut}`,
			`Telefono: ${contacto}`,
			`Direccion despacho: ${direccion}`,
			'',
			'Detalle:',
			detalle || '- Sin productos',
			'',
			`Total referencial: $${total().toLocaleString('es-CL')}`
		].join('\n');

		try {
			const res = await fetch('/api/contacto', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ nombre, correo, mensaje, empresa: '', token: '' })
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok || !data?.ok) {
				errorEnvio =
					data?.detail ||
					data?.error ||
					'No se pudo enviar la solicitud. Revisa la conexión con el backend.';
				return;
			}

			enviado = true;
			errorEnvio = '';
			formValues = {
				nombreApellido: '',
				empresa: '',
				rut: '',
				direccion: '',
				contacto: '',
				mail: ''
			};
			form?.reset?.();
		} catch (error) {
			console.error('Error enviando checkout a contacto:', error);
			errorEnvio =
				'No hay conexión con el servidor para enviar la solicitud. Inténtalo nuevamente en unos minutos.';
		} finally {
			enviando = false;
		}
	}
</script>

<section class="checkout">
	<header class="cabecera">
		<h1>Finalizar compra</h1>
		<p>Completa tus datos para preparar el despacho y realizar tu transferencia bancaria.</p>
	</header>

	<div class="layout">
		<form class="formulario" onsubmit={enviarFormulario}>
			<h2>Datos del cliente</h2>

			<label for="nombre-apellido">Nombre y apellido</label>
			<input
				id="nombre-apellido"
				name="nombreApellido"
				type="text"
				bind:value={formValues.nombreApellido}
				required
			/>

			<label for="empresa">Empresa</label>
			<input id="empresa" name="empresa" type="text" bind:value={formValues.empresa} required />

			<label for="rut">RUT</label>
			<input
				id="rut"
				name="rut"
				type="text"
				placeholder="12.345.678-9"
				bind:value={formValues.rut}
				required
			/>

			<label for="direccion">Dirección de despacho</label>
			<input
				id="direccion"
				name="direccion"
				type="text"
				bind:value={formValues.direccion}
				required
			/>

			<label for="contacto">Número de contacto</label>
			<input id="contacto" name="contacto" type="tel" bind:value={formValues.contacto} required />

			<label for="mail">Mail</label>
			<input id="mail" name="mail" type="email" bind:value={formValues.mail} required />

			<button class="btn-submit" type="submit" disabled={enviando}>
				{enviando ? 'Enviando...' : 'Enviar solicitud de compra'}
			</button>

			{#if enviado}
				<p class="ok">
					Solicitud enviada a ventas@vgv.cl. En breve el equipo VGV te contactara para confirmar
					stock y despacho.
				</p>
			{/if}

			{#if errorEnvio}
				<p class="error">{errorEnvio}</p>
			{/if}
		</form>

		<aside class="resumen">
			<h2>Resumen del pedido</h2>

			{#if items.length === 0}
				<p class="vacio">No hay productos en el carrito.</p>
			{:else}
				<ul class="lista">
					{#each items as item (item.id)}
						<li>
							<span>{item.nombre} x {item.cantidad}</span>
							<strong>${(item.precio * item.cantidad).toLocaleString('es-CL')}</strong>
						</li>
					{/each}
				</ul>

				<p class="total">Total referencial: <strong>${total().toLocaleString('es-CL')}</strong></p>
			{/if}

			<section class="banco">
				<h3>Datos bancarios de VGV (transferencia)</h3>
				<p><strong>Banco:</strong> {datosBancarios.banco}</p>
				<p><strong>Tipo de cuenta:</strong> {datosBancarios.tipoCuenta}</p>
				<p><strong>Numero de cuenta:</strong> {datosBancarios.numeroCuenta}</p>
				<p><strong>RUT:</strong> {datosBancarios.rut}</p>
				<p><strong>Razon social:</strong> {datosBancarios.razonSocial}</p>
				<p><strong>Correo de confirmacion:</strong> {datosBancarios.correo}</p>
			</section>
		</aside>
	</div>
</section>

<style>
	.checkout {
		padding: 1rem 0 2rem;
	}

	.cabecera h1 {
		margin: 0;
		color: var(--vgv-azul-oscuro);
	}

	.cabecera p {
		color: var(--vgv-gris);
		margin: 0.5rem 0 1.5rem;
	}

	.layout {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 1.4rem;
	}

	.formulario,
	.resumen {
		background: white;
		border: 1px solid #e7eef6;
		border-radius: 14px;
		padding: 1rem;
	}

	.formulario h2,
	.resumen h2 {
		margin: 0 0 1rem;
		color: var(--vgv-azul-oscuro);
		font-size: 1.2rem;
	}

	label {
		display: block;
		font-weight: 600;
		color: var(--vgv-azul-oscuro);
		margin: 0.7rem 0 0.35rem;
	}

	input {
		width: 100%;
	}

	.btn-submit {
		margin-top: 1rem;
		width: 100%;
		background: linear-gradient(135deg, var(--vgv-verde) 0%, #2f8b42 100%);
		color: white;
		border: none;
		border-radius: 10px;
		padding: 0.9rem 1rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
		box-shadow: 0 8px 18px rgba(47, 139, 66, 0.17);
	}

	.btn-submit:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 20px rgba(47, 139, 66, 0.22);
	}

	.btn-submit:disabled {
		opacity: 0.75;
		cursor: wait;
		transform: none;
	}

	.ok {
		margin-top: 0.8rem;
		background: #ecfdf3;
		color: #166534;
		border: 1px solid #bbf7d0;
		border-radius: 10px;
		padding: 0.7rem;
		animation: fadeIn 0.25s ease;
	}

	.error {
		margin-top: 0.8rem;
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		border-radius: 10px;
		padding: 0.7rem;
		animation: fadeIn 0.25s ease;
	}

	.lista {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.lista li {
		display: flex;
		justify-content: space-between;
		gap: 0.8rem;
		border-bottom: 1px dashed #d9e5f2;
		padding-bottom: 0.45rem;
	}

	.total {
		margin-top: 0.9rem;
		color: var(--vgv-azul-oscuro);
	}

	.banco {
		margin-top: 1rem;
		border-top: 1px solid #e7eef6;
		padding-top: 0.9rem;
	}

	.banco h3 {
		margin: 0 0 0.6rem;
		color: var(--vgv-azul-oscuro);
		font-size: 1rem;
	}

	.banco p {
		margin: 0.25rem 0;
		color: var(--vgv-gris);
	}

	.vacio {
		color: var(--vgv-gris);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
