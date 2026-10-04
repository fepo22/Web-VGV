<script>
	import { onDestroy } from 'svelte';
	import { backendUrl } from '$lib/utils/backend-url.js';
	import { compressProductImage } from '$lib/utils/compress-product-image.js';
	import {
		MAX_BATCH_FILES,
		duplicateProductIds,
		matchImageProducts
	} from '$lib/utils/image-matching.js';

	let {
		products = [],
		token = '',
		onuploaded = () => {},
		onautherror = () => {},
		onrefresh = async () => {}
	} = $props();
	let rows = $state([]);
	let preparing = $state(false);
	let uploading = $state(false);
	let error = $state('');
	let approved = $state(false);
	let activeRequest;
	let destroyed = false;
	const duplicates = $derived(duplicateProductIds(rows));
	const completed = $derived(rows.filter((row) => row.status === 'done').length);
	const pending = $derived(rows.filter((row) => row.status === 'ready' || row.status === 'error'));
	const canUpload = $derived(
		Boolean(token) &&
			approved &&
			!preparing &&
			!uploading &&
			pending.length > 0 &&
			pending.every(
				(row) =>
					row.blob &&
					row.productId &&
					!duplicates.has(row.productId) &&
					(!row.expectedImage || row.overwrite)
			)
	);

	function releasePreviews() {
		for (const row of rows) if (row.preview) URL.revokeObjectURL(row.preview);
	}

	onDestroy(() => {
		destroyed = true;
		activeRequest?.abort();
		releasePreviews();
	});

	function updateRow(key, patch) {
		rows = rows.map((row) => (row.key === key ? { ...row, ...patch } : row));
	}

	function selectProduct(key, productId) {
		const product = products.find((entry) => String(entry.id) === productId);
		updateRow(key, {
			productId,
			expectedImage: product?.imagen || '',
			overwrite: false,
			error: '',
			status: 'ready'
		});
		approved = false;
	}

	async function prepare(event) {
		const files = Array.from(event.currentTarget.files || []);
		event.currentTarget.value = '';
		if (!files.length) return;
		if (files.length > MAX_BATCH_FILES) {
			error = `Selecciona como máximo ${MAX_BATCH_FILES} archivos por lote.`;
			return;
		}
		releasePreviews();
		rows = [];
		error = '';
		approved = false;
		preparing = true;
		for (const [key, file] of files.entries()) {
			if (destroyed) break;
			const matches = matchImageProducts(file.name, products);
			const product = matches.length === 1 ? matches[0] : null;
			const row = {
				key,
				name: file.name,
				productId: product ? String(product.id) : '',
				expectedImage: product?.imagen || '',
				overwrite: false,
				matchLabel:
					matches.length === 1
						? 'Coincidencia exacta'
						: matches.length
							? 'Ambiguo: selecciona un producto'
							: 'Sin coincidencia: selecciona un producto',
				blob: null,
				preview: '',
				status: 'ready',
				progress: 0,
				error: ''
			};
			try {
				row.blob = await compressProductImage(file);
				if (destroyed) break;
				row.preview = URL.createObjectURL(row.blob);
			} catch (failure) {
				row.status = 'invalid';
				row.error = failure.message || 'No se pudo preparar la imagen.';
			}
			rows = [...rows, row];
		}
		preparing = false;
	}

	function send(row) {
		return new Promise((resolve, reject) => {
			const request = new XMLHttpRequest();
			activeRequest = request;
			request.open('POST', backendUrl('/admin/products/images'));
			request.setRequestHeader('Authorization', `Bearer ${token}`);
			request.timeout = 120_000;
			request.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					updateRow(row.key, { progress: Math.round((event.loaded / event.total) * 100) });
				}
			};
			request.onload = () => {
				let result;
				try {
					result = JSON.parse(request.responseText);
				} catch {
					reject(new Error(`Respuesta inválida del backend (${request.status}).`));
					return;
				}
				if (request.status >= 200 && request.status < 300 && result.product?.imagen) {
					resolve(result);
				} else {
					const failure = new Error(result.error || `Error HTTP ${request.status}.`);
					failure.status = request.status;
					reject(failure);
				}
			};
			request.onerror = () =>
				reject(new Error('Error de red. Verifica el producto antes de reintentar.'));
			request.ontimeout = () =>
				reject(new Error('Tiempo agotado. Recarga el producto antes de reintentar.'));
			request.onabort = () =>
				reject(new Error('Subida cancelada. Verifica el producto antes de reintentar.'));
			const body = new FormData();
			body.append('productId', row.productId);
			body.append('expectedImage', row.expectedImage);
			body.append('overwrite', String(row.overwrite));
			body.append('image', row.blob, 'product.webp');
			request.send(body);
		});
	}

	async function uploadBatch() {
		if (!canUpload) return;
		uploading = true;
		error = '';
		const queue = [...pending];
		for (const row of queue) {
			if (destroyed) break;
			updateRow(row.key, { status: 'uploading', progress: 0, error: '' });
			try {
				const result = await send(row);
				updateRow(row.key, { status: 'done', progress: 100, expectedImage: result.product.imagen });
				// Una excepción del integrador nunca convierte una subida confirmada en retry.
				try {
					await onuploaded(result.product, result);
				} catch {
					error = 'Imagen guardada; no se pudo refrescar la lista. Recarga los productos.';
				}
			} catch (failure) {
				updateRow(row.key, { status: 'error', error: failure.message });
				if (![401, 403, 429].includes(failure.status)) {
					try {
						await onrefresh();
					} catch {
						error = 'Actualiza los productos antes de reintentar.';
					}
				}
				if ([401, 403, 429].includes(failure.status)) {
					error = failure.message;
					if ([401, 403].includes(failure.status)) onautherror(failure.status);
					break;
				}
			} finally {
				activeRequest = null;
			}
		}
		uploading = false;
		approved = false;
	}
</script>

<section class="image-batch" aria-label="Carga de imágenes en lote">
	<h2>Imágenes de productos</h2>
	<p>
		Hasta 30 archivos JPEG, PNG o WebP, originales de hasta 10 MiB. Salida WebP ≤ 1 MiB y 1600 ×
		1600 px.
	</p>
	<p>
		El nombre sin extensión debe coincidir exactamente con código, ID o SKU (sin distinguir
		mayúsculas). Revisa las asociaciones antes de confirmar.
	</p>
	<label class="file-picker">
		Seleccionar lote
		<input
			type="file"
			accept="image/jpeg,image/png,image/webp"
			multiple
			disabled={preparing || uploading}
			onchange={prepare}
		/>
	</label>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if preparing}<p role="status">Preparando vistas previas: {rows.length} archivos…</p>{/if}
	{#if rows.length}
		<p role="status">Guardadas: {completed} / {rows.length}</p>
		<div class="batch-rows">
			{#each rows as row (row.key)}
				<article class="batch-row">
					{#if row.preview}<img
							src={row.preview}
							alt={`Vista previa de ${row.name}`}
							width="96"
							height="96"
						/>{/if}
					<div class="row-controls">
						<strong>{row.name}</strong>
						<span>{row.matchLabel}</span>
						{#if row.blob}<small>{Math.ceil(row.blob.size / 1024)} KiB comprimidos</small>{/if}
						<label>
							Producto destino
							<select
								value={row.productId}
								disabled={preparing || uploading || ['done', 'invalid'].includes(row.status)}
								onchange={(event) => selectProduct(row.key, event.currentTarget.value)}
							>
								<option value="">Seleccionar manualmente</option>
								{#each products as product (product.id)}
									<option value={String(product.id)}
										>{product.codigo || product.id} — {product.nombre}</option
									>
								{/each}
							</select>
						</label>
						{#if row.expectedImage && row.status !== 'done'}
							<div class="overwrite-preview">
								<img
									src={row.expectedImage}
									alt="Imagen actual que será reemplazada"
									width="64"
									height="64"
								/>
								<label
									><input
										type="checkbox"
										checked={row.overwrite}
										disabled={preparing || uploading || row.status === 'invalid'}
										onchange={(event) => {
											updateRow(row.key, { overwrite: event.currentTarget.checked });
											approved = false;
										}}
									/> Confirmo reemplazar la imagen actual</label
								>
							</div>
						{/if}
						{#if duplicates.has(row.productId)}<p class="error">
								Otro archivo del lote apunta al mismo producto. Cambia la selección o quita uno.
							</p>{/if}
						{#if row.error}<p class="error" role="alert">{row.error}</p>{/if}
						{#if row.status === 'uploading'}<progress max="100" value={row.progress}
							></progress><span>{row.progress}% enviado; esperando confirmación del servidor</span
							>{/if}
						{#if row.status === 'done'}<span>Guardada</span>{/if}
						{#if row.status !== 'done'}
							<button
								type="button"
								disabled={preparing || uploading}
								onclick={() => {
									if (row.preview) URL.revokeObjectURL(row.preview);
									rows = rows.filter((entry) => entry.key !== row.key);
									approved = false;
								}}>Quitar archivo</button
							>
						{/if}
						{#if row.status === 'error'}
							<button
								type="button"
								disabled={preparing || uploading}
								onclick={() => selectProduct(row.key, row.productId)}
								>Usar imagen actual del producto y volver a confirmar</button
							>
						{/if}
					</div>
				</article>
			{/each}
		</div>
		<label class="approval"
			><input type="checkbox" bind:checked={approved} disabled={preparing || uploading} /> Revisé las
			vistas previas y los productos destino del lote pendiente</label
		>
		<button type="button" class="submit" disabled={!canUpload} onclick={uploadBatch}
			>Confirmar y subir pendientes / reintentar errores ({pending.length})</button
		>
	{/if}
</section>

<style>
	.image-batch {
		padding: 1.25rem;
		border: 1px solid #dbe3ec;
		border-radius: 1rem;
		background: #fff;
		color: #173047;
	}
	.batch-rows {
		display: grid;
		gap: 1rem;
		margin: 1rem 0;
	}
	.batch-row {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem;
		background: #f6f8fb;
		border-radius: 0.75rem;
	}
	.row-controls {
		display: grid;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	img {
		object-fit: contain;
		border-radius: 0.5rem;
		background: #fff;
	}
	label {
		display: block;
	}
	select {
		display: block;
		width: 100%;
		min-width: 0;
		padding: 0.6rem;
	}
	.overwrite-preview {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	button {
		padding: 0.65rem 1rem;
		border-radius: 0.5rem;
		cursor: pointer;
		border: 1px solid #cbd5e1;
		background: #fff;
	}
	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.submit {
		background: #173047;
		color: #fff;
		margin-top: 1rem;
	}
	.error {
		color: #a52020;
	}
	.approval {
		margin-top: 1rem;
	}
	progress {
		width: 100%;
	}
	@media (max-width: 600px) {
		.batch-row {
			flex-direction: column;
		}
		.row-controls {
			width: 100%;
		}
	}
</style>
