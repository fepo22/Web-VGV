<script>
	import { onDestroy, untrack } from 'svelte';
	import { familias, normalizeFamiliaSlug } from '$lib/data/categorias.js';
	import RelatedProductSelector from '$lib/components/RelatedProductSelector.svelte';
	import { compressProductImage } from '$lib/utils/compress-product-image.js';
	import { PRODUCT_IMAGE_PLACEHOLDER } from '$lib/utils/save-product.js';

	const {
		product = null,
		products = [],
		loading = false,
		saveError = '',
		savedProduct = null,
		onSubmit,
		onCancel
	} = $props();

	let nombre = $state('');
	let codigo = $state('');
	let descripcion = $state('');
	let precioCosto = $state('0');
	let familiaSlug = $state('');
	let subfamiliaSlug = $state('');
	let categoriaSlug = $state('');
	let imagen = $state('');
	let stock = $state('1');
	let estado = $state('disponible');
	let variantes = $state([]);
	let relatedProductIds = $state([]);
	let imageFile = $state(null);
	let imagePreview = $state('');
	let imageName = $state('');
	let imageError = $state('');
	let preparingImage = $state(false);
	let submitting = $state(false);
	let submitError = $state('');
	let replaceApproved = $state(false);
	let imageInput;
	let selectionVersion = 0;
	let destroyed = false;
	const currentImage = $derived(savedProduct?.imagen ?? product?.imagen ?? '');
	const replacesImage = $derived(
		Boolean(imageFile && currentImage && currentImage !== PRODUCT_IMAGE_PLACEHOLDER)
	);
	let nextVariantKey = 0;

	function clearSelectedImage() {
		selectionVersion += 1;
		if (imagePreview) URL.revokeObjectURL(imagePreview);
		imageFile = null;
		imagePreview = '';
		imageName = '';
		imageError = '';
		preparingImage = false;
		replaceApproved = false;
		if (imageInput) imageInput.value = '';
	}

	onDestroy(() => {
		destroyed = true;
		clearSelectedImage();
	});

	async function selectImage(event) {
		const file = event.currentTarget.files?.[0];
		clearSelectedImage();
		if (!file) return;
		const version = selectionVersion;
		preparingImage = true;
		try {
			const compressed = await compressProductImage(file);
			if (destroyed || version !== selectionVersion) return;
			imageFile = compressed;
			imageName = file.name;
			imagePreview = URL.createObjectURL(compressed);
		} catch (failure) {
			if (!destroyed && version === selectionVersion) {
				imageError = failure?.message || 'No se pudo preparar la imagen.';
			}
		} finally {
			if (!destroyed && version === selectionVersion) preparingImage = false;
		}
	}

	function findFamilia(slug) {
		return familias.find((item) => item.slug === slug);
	}

	function findSubfamilia(familiaId, subfamiliaId) {
		return findFamilia(familiaId)?.subfamilias.find((item) => item.slug === subfamiliaId);
	}

	function labelDesdeSlug(options, slug) {
		return options?.find((item) => item.slug === slug)?.nombre ?? '';
	}

	function syncForm() {
		clearSelectedImage();
		nombre = product?.nombre ?? '';
		codigo = product?.codigo ?? '';
		descripcion = product?.descripcion ?? '';
		precioCosto = String(product?.precioCosto ?? 0);
		familiaSlug = normalizeFamiliaSlug(product?.familiaSlug ?? product?.categoriaSlug ?? '');
		subfamiliaSlug = product?.subfamiliaSlug ?? '';
		categoriaSlug = product?.familiaSlug ? (product?.categoriaSlug ?? '') : '';
		imagen = product?.imagen ?? '';
		relatedProductIds = [...(product?.relatedProductIds ?? [])].map(String);
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
		untrack(syncForm);
	});

	$effect(() => {
		currentImage;
		untrack(() => (replaceApproved = false));
	});

	$effect(() => {
		if (savedProduct) imagen = savedProduct.imagen ?? '';
	});

	async function handleSubmit(event) {
		event.preventDefault();
		if (
			loading ||
			submitting ||
			preparingImage ||
			imageError ||
			(replacesImage && !replaceApproved)
		)
			return;
		submitting = true;
		submitError = '';
		try {
			const variantesPayload = variantes.map(({ sku, medida, minima }) => ({
				sku: sku.trim(),
				medida: medida.trim(),
				minima: Number(minima)
			}));

			const result = await onSubmit?.(
				{
					nombre: nombre.trim(),
					codigo: codigo.trim(),
					descripcion: descripcion.trim(),
					precioCosto: Number(precioCosto),
					familia: labelDesdeSlug(familias, familiaSlug),
					familiaSlug,
					subfamilia: labelDesdeSlug(findFamilia(familiaSlug)?.subfamilias, subfamiliaSlug),
					subfamiliaSlug,
					categoria: labelDesdeSlug(
						findSubfamilia(familiaSlug, subfamiliaSlug)?.categorias,
						categoriaSlug
					),
					categoriaSlug,
					imagen: imageFile ? currentImage || PRODUCT_IMAGE_PLACEHOLDER : imagen.trim(),
					relatedProductIds,
					stock: Number(stock),
					estado,
					...(product || savedProduct || variantes.length ? { variantes: variantesPayload } : {})
				},
				imageFile
			);
			if (!destroyed && result?.imageFailed) replaceApproved = false;
		} catch (failure) {
			if (!destroyed) submitError = failure?.message || 'No se pudo guardar el producto.';
		} finally {
			if (!destroyed) submitting = false;
		}
	}

	function onFamiliaChange(value) {
		familiaSlug = value;
		subfamiliaSlug = '';
		categoriaSlug = '';
	}

	function onSubfamiliaChange(value) {
		subfamiliaSlug = value;
		categoriaSlug = '';
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
				<button class="ghost" type="button" disabled={loading || submitting} onclick={onCancel}
					>Cancelar edición</button
				>
			{/if}
			<p>
				{product
					? 'Modifica los datos y guarda los cambios en el backend protegido.'
					: 'Registra productos con los campos mínimos para mantener el catálogo actualizado.'}
			</p>
		</div>
	</div>

	<fieldset class="grid" disabled={loading || submitting} aria-label="Datos del producto">
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
			Precio costo
			<input bind:value={precioCosto} type="number" min="0" step="1" placeholder="0" required />
		</label>

		<label>
			Familia
			<select value={familiaSlug} onchange={(e) => onFamiliaChange(e.currentTarget.value)} required>
				<option value="" disabled>Selecciona una familia</option>
				{#each familias as item (item.slug)}
					<option value={item.slug}>{item.nombre}</option>
				{/each}
			</select>
		</label>

		<label>
			Subfamilia
			<select
				value={subfamiliaSlug}
				onchange={(e) => onSubfamiliaChange(e.currentTarget.value)}
				disabled={!familiaSlug}
				required={!product || Boolean(subfamiliaSlug)}
			>
				<option value="" disabled>Selecciona una subfamilia</option>
				{#each findFamilia(familiaSlug)?.subfamilias ?? [] as item (item.slug)}
					<option value={item.slug}>{item.nombre}</option>
				{/each}
			</select>
		</label>

		{#if findSubfamilia(familiaSlug, subfamiliaSlug)?.categorias?.length}
			<label>
				Categoría
				<select bind:value={categoriaSlug} required>
					<option value="" disabled>Selecciona una categoría</option>
					{#each findSubfamilia(familiaSlug, subfamiliaSlug).categorias as item (item.slug)}
						<option value={item.slug}>{item.nombre}</option>
					{/each}
				</select>
			</label>
		{/if}

		<label>
			URL de imagen (opcional si subes un archivo)
			<input
				bind:value={imagen}
				type="text"
				placeholder="/images/mi-producto.png"
				required={!imageFile}
				disabled={Boolean(imageFile) || loading || preparingImage}
			/>
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
				<button
					class="ghost"
					type="button"
					onclick={() =>
						(variantes = [...variantes, { key: ++nextVariantKey, sku: '', medida: '', minima: 1 }])}
					>Agregar variante</button
				>
			</div>
			{#each variantes as variante (variante.key)}
				<div class="variant-row">
					<label>SKU <input bind:value={variante.sku} required placeholder="DP-20" /></label>
					<label
						>Medida <input bind:value={variante.medida} required placeholder="20 mm x 6 m" /></label
					>
					<label
						>Cantidad mínima <input
							type="number"
							min="1"
							step="1"
							bind:value={variante.minima}
							required
						/></label
					>
					<button
						class="remove-variant"
						type="button"
						title="Eliminar variante"
						aria-label={`Eliminar variante ${variante.sku || variante.key}`}
						onclick={() => (variantes = variantes.filter((item) => item.key !== variante.key))}
						>×</button
					>
				</div>
			{/each}
		</div>
	</fieldset>

	<fieldset class="image-upload" disabled={loading || submitting}>
		<legend>Imagen del producto</legend>
		<p>
			Sube JPEG, PNG o WebP de hasta 10 MiB. Se comprime a WebP, máximo 1600 px y 1 MiB, y se asocia
			al guardar la ficha.
		</p>
		<label
			>Seleccionar imagen
			<input
				bind:this={imageInput}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				onchange={selectImage}
			/>
		</label>
		{#if preparingImage}<p role="status">Comprimiendo imagen…</p>{/if}
		{#if imageError}<p class="form-error" role="alert">{imageError}</p>{/if}
		{#if imagePreview}
			<div class="image-preview">
				<img src={imagePreview} alt="Vista previa de la imagen a subir" width="160" height="160" />
				<div>
					<strong>{imageName}</strong>
					<p>{Math.ceil(imageFile.size / 1024)} KiB · WebP comprimido</p>
					<button class="ghost" type="button" onclick={clearSelectedImage}
						>Quitar imagen seleccionada</button
					>
				</div>
			</div>
		{/if}
		{#if replacesImage}
			<div class="image-preview">
				<img src={currentImage} alt="Imagen actual del producto" width="80" height="80" />
				<label class="replace-confirmation"
					><input type="checkbox" bind:checked={replaceApproved} /> Confirmo reemplazar la imagen actual
					al guardar</label
				>
			</div>
		{/if}
	</fieldset>

	{#if saveError || submitError}<p class="form-error" role="alert">
			{saveError || submitError}
		</p>{/if}
	{#if savedProduct}
		<p role="status">
			La ficha ya existe (código {savedProduct.codigo}). Al guardar nuevamente se actualizará este
			mismo producto.
		</p>
	{/if}

	<fieldset
		class="related-fields"
		disabled={loading || submitting}
		aria-label="Selección de relacionados"
	>
		<RelatedProductSelector
			{products}
			currentId={savedProduct?.id ?? product?.id ?? ''}
			selectedIds={relatedProductIds}
			onchange={(ids) => (relatedProductIds = ids)}
		/>
	</fieldset>

	<button
		class="submit"
		type="submit"
		disabled={loading ||
			submitting ||
			preparingImage ||
			Boolean(imageError) ||
			(replacesImage && !replaceApproved)}
	>
		{loading || submitting
			? 'Guardando ficha e imagen...'
			: preparingImage
				? 'Preparando imagen...'
				: product || savedProduct
					? 'Guardar cambios'
					: 'Crear producto'}
	</button>
</form>

<style>
	.related-fields {
		display: contents;
	}
	.image-upload {
		min-width: 0;
		border: 1px solid var(--vgv-border-soft);
		border-radius: 14px;
		padding: 1rem;
	}
	.image-upload legend {
		font-weight: 800;
		padding: 0 0.4rem;
	}
	.image-upload p {
		margin: 0.4rem 0 0.8rem;
	}
	.image-preview {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		margin-top: 1rem;
		overflow-wrap: anywhere;
	}
	.image-preview img {
		object-fit: contain;
		background: #f6f8fb;
		border-radius: 10px;
	}
	.replace-confirmation {
		flex-direction: row;
		align-items: center;
		flex: 1;
	}
	.replace-confirmation input {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}
	.form-error {
		color: var(--vgv-danger, #a52020);
		background: #fff3f3;
		padding: 0.75rem;
		border-radius: 8px;
	}
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
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.variants-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}
	.variants-head h3 {
		margin: 0;
		font-size: 1rem;
	}
	.variant-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 120px 40px;
		align-items: end;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}
	.remove-variant {
		width: 40px;
		height: 40px;
		border: 1px solid var(--vgv-border-soft);
		border-radius: 4px;
		background: transparent;
		color: var(--vgv-danger);
		font-size: 1.5rem;
		cursor: pointer;
	}

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
		.variant-row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
