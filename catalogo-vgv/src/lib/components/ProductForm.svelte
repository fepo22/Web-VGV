<script>
	import { categorias } from '$lib/data/categorias.js';

	const { product = null, loading = false, onSubmit, onCancel } = $props();

	let nombre = $state('');
	let codigo = $state('');
	let descripcion = $state('');
	let categoriaSlug = $state('sin-categoria');
	let categoria = $state('Sin categoria');
	let imagen = $state('');
	let stock = $state('1');
	let estado = $state('disponible');
	let variantes = $state([]);
	let nextVariantKey = 0;

	function slugify(value) {
		return String(value ?? '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
	}

	function categoriaDesdeSlug(slug) {
		return categorias.find((item) => item.slug === slug)?.nombre ?? 'Sin categoria';
	}

	function syncForm() {
		nombre = product?.nombre ?? '';
		codigo = product?.codigo ?? '';
		descripcion = product?.descripcion ?? '';
		categoriaSlug =
			(product?.categoriaSlug ?? slugify(product?.categoria || '')) || 'sin-categoria';
		categoria = product?.categoria ?? categoriaDesdeSlug(categoriaSlug);
		imagen = product?.imagen ?? '';
		stock = String(product?.stock ?? 1);
		estado = product?.estado === 'sin stock' ? 'sin stock' : 'disponible';
		variantes = Array.isArray(product?.variantes)
			? product.variantes.map((variante) => ({
					key: ++nextVariantKey,
					sku: variante.sku || '',
					medida: variante.medida || '',
					minima: variante.minima ?? 1
				}))
			: [];
	}

	$effect(() => {
		product;
		syncForm();
	});

	async function handleSubmit(event) {
		event.preventDefault();
		const variantesPayload = variantes.map(({ sku, medida, minima }) => ({
			sku: sku.trim(), medida: medida.trim(), minima: Number(minima)
		}));

		await onSubmit?.({
			nombre: nombre.trim(),
			codigo: codigo.trim(),
			descripcion: descripcion.trim(),
			categoria: categoria.trim() || categoriaDesdeSlug(categoriaSlug),
			categoriaSlug: categoriaSlug.trim() || slugify(categoria),
			imagen: imagen.trim(),
			stock: Number(stock),
			estado,
			...(product || variantes.length ? { variantes: variantesPayload } : {})
		});
	}

	function onCategoriaChange(value) {
		categoriaSlug = value;
		categoria = categoriaDesdeSlug(value);
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
			Descripcion
			<textarea bind:value={descripcion} rows="3" placeholder="Descripcion comercial del producto"
			></textarea>
		</label>

		<label>
			Categoria
			<select value={categoriaSlug} onchange={(e) => onCategoriaChange(e.currentTarget.value)}>
				<option value="sin-categoria">Sin categoria</option>
				{#each categorias as item (item.slug)}
					<option value={item.slug}>{item.nombre}</option>
				{/each}
			</select>
		</label>

		<label>
			Categoria slug
			<input bind:value={categoriaSlug} type="text" placeholder="canalizacion" required />
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

		<div class="variants full">
			<div class="variants-head">
				<h3>Variantes</h3>
				<button class="ghost" type="button" onclick={() => variantes = [...variantes, { key: ++nextVariantKey, sku: '', medida: '', minima: 1 }]}>Agregar variante</button>
			</div>
			{#each variantes as variante (variante.key)}
				<div class="variant-row">
					<label>SKU <input bind:value={variante.sku} required placeholder="DP-20" /></label>
					<label>Medida <input bind:value={variante.medida} required placeholder="20 mm x 6 m" /></label>
					<label>Cantidad mínima <input type="number" min="1" step="1" bind:value={variante.minima} required /></label>
					<button class="remove-variant" type="button" title="Eliminar variante" aria-label={`Eliminar variante ${variante.sku || variante.key}`} onclick={() => variantes = variantes.filter((item) => item.key !== variante.key)}>×</button>
				</div>
			{/each}
		</div>
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

	.variants-head { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; }
	.variants-head h3 { margin: 0; font-size: 1rem; }
	.variant-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 120px 40px; align-items: end; gap: 0.6rem; margin-top: 0.5rem; }
	.remove-variant { width: 40px; height: 40px; border: 1px solid var(--vgv-border-soft); border-radius: 4px; background: transparent; color: var(--vgv-danger); font-size: 1.5rem; cursor: pointer; }

	label {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
	}

	.grid > label:last-of-type {
		grid-column: span 2;
	}

	.grid > .full {
		grid-column: span 2;
	}

	input,
	select,
	textarea {
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

		.grid > label:last-of-type,
		.grid > .full {
			grid-column: auto;
		}
	}
	@media (max-width: 650px) {
		.variant-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
</style>
