<script>
	const { product = null, loading = false, onSubmit, onCancel } = $props();

	let nombre = $state('');
	let codigo = $state('');
	let precio = $state('');
	let imagen = $state('');
	let stock = $state('0');
	let estado = $state('disponible');

	function syncForm() {
		nombre = product?.nombre ?? '';
		codigo = product?.codigo ?? '';
		precio = product?.precio ?? '';
		imagen = product?.imagen ?? '';
		stock = String(product?.stock ?? 0);
		estado = product?.estado === 'sin stock' ? 'sin stock' : 'disponible';
	}

	$effect(() => {
		product;
		syncForm();
	});

	async function handleSubmit(event) {
		event.preventDefault();

		await onSubmit?.({
			nombre: nombre.trim(),
			codigo: codigo.trim(),
			precio: Number(precio),
			imagen: imagen.trim(),
			stock: Number(stock),
			estado
		});
	}
</script>

<form class="product-form card" onsubmit={handleSubmit}>
	<div class="form-head">
		<div>
			<p class="eyebrow">{product ? 'Editar producto' : 'Nuevo producto'}</p>
			<h2>{product ? 'Actualizar ficha' : 'Alta rapida'}</h2>
		</div>
		<div class="header-actions">
			{#if product}
				<button class="ghost" type="button" onclick={onCancel}>Cancelar edición</button>
			{/if}
			<p>
				{product
					? 'Modifica los datos y guarda los cambios en el backend protegido.'
					: 'Registra productos con los campos mínimos para mantener el catálogo actualizado.'}
			</p>
		</div>
	</div>

	<div class="grid">
		<label>
			Nombre
			<input bind:value={nombre} type="text" placeholder="Nombre del producto" required />
		</label>

		<label>
			Codigo
			<input bind:value={codigo} type="text" placeholder="VGV-0001" required />
		</label>

		<label>
			Precio
			<input bind:value={precio} type="number" min="0" step="1" placeholder="0" required />
		</label>

		<label>
			Imagen
			<input bind:value={imagen} type="text" placeholder="/images/mi-producto.png" required />
		</label>

		<label>
			Stock
			<input bind:value={stock} type="number" min="0" step="1" placeholder="0" required />
		</label>

		<label>
			Estado
			<select bind:value={estado}>
				<option value="disponible">Disponible</option>
				<option value="sin stock">Sin stock</option>
			</select>
		</label>
	</div>

	<button class="submit" type="submit" disabled={loading}>
		{loading ? 'Guardando...' : product ? 'Guardar cambios' : 'Crear producto'}
	</button>
</form>

<style>
	.product-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--vgv-verde);
	}

	h2 {
		margin: 0;
		color: var(--vgv-azul-oscuro);
	}

	.header-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.65rem;
		text-align: right;
	}

	.header-actions p {
		margin: 0;
		color: var(--vgv-gris);
		max-width: 30rem;
	}

	.ghost {
		border: 1px solid var(--vgv-border-soft);
		background: var(--vgv-blanco);
		color: var(--vgv-azul-oscuro);
		border-radius: 999px;
		padding: 0.7rem 1rem;
		font-weight: 800;
		cursor: pointer;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
	}

	label:last-of-type {
		grid-column: span 2;
	}

	input,
	select {
		width: 100%;
	}

	.submit {
		align-self: flex-start;
		border: none;
		border-radius: 999px;
		padding: 0.85rem 1.25rem;
		font-weight: 800;
		cursor: pointer;
		background: var(--vgv-verde);
		color: var(--vgv-blanco);
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			opacity 0.15s ease;
	}

	.submit:hover:not(:disabled),
	.ghost:hover {
		transform: translateY(-1px);
		box-shadow: var(--vgv-shadow-md);
	}

	.submit:disabled {
		opacity: 0.65;
		cursor: wait;
	}

	@media (max-width: 900px) {
		.form-head,
		.header-actions {
			align-items: flex-start;
			text-align: left;
		}

		.grid {
			grid-template-columns: 1fr;
		}

		label:last-of-type {
			grid-column: auto;
		}
	}
</style>
