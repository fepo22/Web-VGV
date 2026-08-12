<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import { io } from 'socket.io-client';
	import Loader from '$lib/components/Loader.svelte';
	import ProductForm from '$lib/components/ProductForm.svelte';
	import ProductTable from '$lib/components/ProductTable.svelte';
	import { backendUrl, getBackendUrl } from '$lib/utils/backend-url.js';

	const STORAGE_KEY = 'vgv_admin_token';

	let token = $state('');
	let products = $state([]);
	let loading = $state(true);
	let saving = $state(false);
	let actionLoadingId = $state('');
	let editingProduct = $state(null);
	let lastAdded = $state('');
	let error = $state('');
	let notice = $state('');
	let searchTerm = $state('');

	let socket = null;

	const metrics = $derived.by(() => {
		const total = products.length;
		const available = products.filter((product) => product.estado === 'disponible').length;
		const outOfStock = products.filter((product) => product.estado === 'sin stock').length;

		return {
			total,
			available,
			outOfStock,
			lastAdded: lastAdded || (products[0]?.nombre ?? 'Sin registros')
		};
	});

	const filteredProducts = $derived.by(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return products;

		return products.filter((product) => {
			const code = String(product.codigo || `VGV-${String(product.id ?? '').padStart(4, '0')}`)
				.toLowerCase()
				.trim();
			const name = String(product.nombre || '')
				.toLowerCase()
				.trim();
			return code.includes(term) || name.includes(term);
		});
	});

	function upsertProduct(product) {
		if (!product?.id) return;

		const exists = products.some((entry) => String(entry.id) === String(product.id));
		if (exists) {
			products = products.map((entry) =>
				String(entry.id) === String(product.id) ? { ...entry, ...product } : entry
			);
			return;
		}

		products = [product, ...products];
	}

	function setupSocket() {
		if (!browser || !token) return;

		socket = io(getBackendUrl(), {
			auth: { token }
		});

		socket.on('connect_error', () => {
			error = 'No se pudo conectar al canal en tiempo real.';
		});

		socket.on('productAdded', (product) => {
			upsertProduct(product);
			lastAdded = product?.nombre || lastAdded;
			notice = `Producto agregado: ${product?.nombre || ''}`.trim();
		});

		socket.on('productUpdated', (product) => {
			upsertProduct(product);
			notice = `Producto actualizado: ${product?.nombre || ''}`.trim();
		});

		socket.on('productDeleted', ({ id }) => {
			products = products.filter((product) => String(product.id) !== String(id));
			notice = `Producto eliminado (ID ${id}).`;
			if (editingProduct?.id && String(editingProduct.id) === String(id)) {
				editingProduct = null;
			}
		});
	}

	function teardownSocket() {
		if (!socket) return;
		socket.removeAllListeners();
		socket.disconnect();
		socket = null;
	}

	onMount(() => {
		if (!browser) return;

		token = localStorage.getItem(STORAGE_KEY) || '';
		if (!token) {
			goto(resolve('/admin/login'));
			return;
		}

		void loadProducts().finally(() => {
			setupSocket();
		});
	});

	onDestroy(() => {
		teardownSocket();
	});

	function logout(message = '') {
		if (browser) {
			localStorage.removeItem(STORAGE_KEY);
		}
		teardownSocket();
		products = [];
		editingProduct = null;
		error = message;
		notice = '';
		goto(resolve('/admin/login'));
	}

	function startEditing(product) {
		editingProduct = { ...product };
		error = '';
		notice = '';
	}

	function cancelEditing() {
		editingProduct = null;
	}

	function csvSafe(value) {
		const text = String(value ?? '').replace(/"/g, '""');
		return `"${text}"`;
	}

	function exportProductsCsv() {
		if (!browser || products.length === 0) {
			error = 'No hay productos para exportar.';
			return;
		}

		const headers = [
			'codigo',
			'id',
			'nombre',
			'precio',
			'precio_descuento',
			'oferta',
			'descuento_pct',
			'stock',
			'estado',
			'categoria'
		];
		const rows = products.map((product) => {
			const fallbackCode = `VGV-${String(product.id ?? '').padStart(4, '0')}`;
			const precio = Number(product.precio ?? 0);
			const precioDescuento = Number(product.precioDescuento);
			const isOffer =
				Boolean(product.oferta) ||
				(Number.isFinite(precioDescuento) && precioDescuento > 0 && precioDescuento < precio);
			const descuentoPct = isOffer
				? Math.max(1, Math.round(((precio - precioDescuento) / precio) * 100))
				: '';

			return [
				product.codigo || fallbackCode,
				product.id,
				product.nombre,
				precio,
				isOffer ? precioDescuento : '',
				isOffer ? 'si' : 'no',
				descuentoPct,
				Number(product.stock ?? 0),
				product.estado || (Number(product.stock ?? 0) > 0 ? 'disponible' : 'sin stock'),
				product.categoria || ''
			];
		});

		const csvLines = [headers.join(';'), ...rows.map((row) => row.map(csvSafe).join(';'))];
		const csvContent = `\uFEFF${csvLines.join('\n')}`;
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

		link.href = url;
		link.download = `vgv-productos-${stamp}.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);

		notice = `CSV exportado con ${products.length} productos.`;
		error = '';
	}

	async function loadProducts() {
		if (!token) return;

		loading = true;
		error = '';

		try {
			const response = await fetch(backendUrl('/admin/products'), {
				headers: {
					accept: 'application/json',
					Authorization: `Bearer ${token}`
				}
			});

			if (response.status === 401) {
				logout('Tu sesión expiró. Vuelve a iniciar sesión.');
				return;
			}

			if (!response.ok) {
				throw new Error('No se pudieron cargar los productos.');
			}

			const data = await response.json();
			products = Array.isArray(data) ? data : [];
			lastAdded = products[0]?.nombre ?? '';
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : 'Error cargando productos.';
		} finally {
			loading = false;
		}
	}

	async function saveProduct(payload) {
		if (!token) {
			error = 'Debes iniciar sesión nuevamente.';
			return;
		}

		saving = true;
		error = '';

		try {
			const method = editingProduct?.id ? 'PUT' : 'POST';
			const endpoint = editingProduct?.id
				? backendUrl(`/admin/products/${editingProduct.id}`)
				: backendUrl('/admin/products');
			const response = await fetch(endpoint, {
				method,
				headers: {
					'content-type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(payload)
			});

			if (response.status === 401) {
				logout('Tu sesión expiró. Vuelve a iniciar sesión.');
				return;
			}

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.error || 'No se pudo guardar el producto.');
			}

			upsertProduct(data);
			if (!editingProduct?.id) {
				lastAdded = data?.nombre || lastAdded;
			}

			notice = editingProduct?.id
				? 'Producto actualizado correctamente.'
				: 'Producto creado correctamente.';
			editingProduct = null;
		} catch (saveError) {
			error = saveError instanceof Error ? saveError.message : 'Error guardando producto.';
		} finally {
			saving = false;
		}
	}

	async function toggleStatus(product) {
		const nextStatus = product.estado === 'disponible' ? 'sin stock' : 'disponible';
		actionLoadingId = `${product.id}-status`;
		error = '';

		try {
			const response = await fetch(backendUrl(`/admin/products/${product.id}`), {
				method: 'PUT',
				headers: {
					'content-type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ estado: nextStatus })
			});

			if (response.status === 401) {
				logout('Tu sesión expiró. Vuelve a iniciar sesión.');
				return;
			}

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.error || 'No se pudo actualizar el producto.');
			}

			upsertProduct(data);
			notice = 'Estado actualizado correctamente.';
		} catch (toggleError) {
			error = toggleError instanceof Error ? toggleError.message : 'Error actualizando producto.';
		} finally {
			actionLoadingId = '';
		}
	}

	async function deleteProduct(product) {
		if (!window.confirm(`¿Eliminar ${product.nombre}?`)) return;

		actionLoadingId = `${product.id}-delete`;
		error = '';

		try {
			const response = await fetch(backendUrl(`/admin/products/${product.id}`), {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (response.status === 401) {
				logout('Tu sesión expiró. Vuelve a iniciar sesión.');
				return;
			}

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data?.error || 'No se pudo eliminar el producto.');
			}

			products = products.filter((item) => String(item.id) !== String(product.id));
			if (editingProduct?.id && String(editingProduct.id) === String(product.id)) {
				editingProduct = null;
			}
			notice = 'Producto eliminado correctamente.';
		} catch (deleteError) {
			error = deleteError instanceof Error ? deleteError.message : 'Error eliminando producto.';
		} finally {
			actionLoadingId = '';
		}
	}
</script>

<svelte:head>
	<title>Dashboard Admin VGV</title>
</svelte:head>

<section class="admin-shell">
	<header class="hero card">
		<div>
			<p class="eyebrow">Panel de administración</p>
			<h1>Dashboard en tiempo real</h1>
			<p>Monitorea cambios de productos sin recargar gracias a Socket.io.</p>
		</div>
		<button class="logout" type="button" onclick={() => logout('Sesión cerrada correctamente.')}
			>Cerrar sesión</button
		>
	</header>

	{#if loading}
		<section class="panel card">
			<Loader />
		</section>
	{:else}
		<section class="metrics-grid">
			<article class="metric card">
				<p>Total de productos</p>
				<strong>{metrics.total}</strong>
			</article>
			<article class="metric card">
				<p>Disponibles</p>
				<strong>{metrics.available}</strong>
			</article>
			<article class="metric card">
				<p>Sin stock</p>
				<strong>{metrics.outOfStock}</strong>
			</article>
			<article class="metric card">
				<p>Último agregado</p>
				<strong>{metrics.lastAdded}</strong>
			</article>
		</section>

		<section class="stacked">
			<ProductForm
				product={editingProduct}
				loading={saving}
				onSubmit={saveProduct}
				onCancel={cancelEditing}
			/>

			<section class="panel card">
				<div class="panel-head">
					<div>
						<h2>Productos</h2>
						<p>
							{filteredProducts.length} de {products.length} productos
							{searchTerm.trim() ? ' (filtrados)' : ' sincronizados'}.
						</p>
					</div>
					<div class="panel-actions">
						<button class="refresh" type="button" onclick={loadProducts}>Refrescar</button>
						<button class="refresh" type="button" onclick={exportProductsCsv}>Exportar CSV</button>
					</div>
				</div>

				<div class="search-row">
					<label for="product-search">Buscar por codigo o nombre</label>
					<input
						id="product-search"
						type="search"
						placeholder="Ej: VGV-0049 o Codo 90"
						bind:value={searchTerm}
					/>
				</div>

				{#if error}
					<p class="feedback error">{error}</p>
				{/if}

				{#if notice}
					<p class="feedback ok">{notice}</p>
				{/if}

				<ProductTable
					products={filteredProducts}
					loadingId={actionLoadingId}
					onEdit={startEditing}
					onToggleStatus={toggleStatus}
					onDelete={deleteProduct}
				/>
			</section>
		</section>
	{/if}
</section>

<style>
	.admin-shell {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 0 2rem;
	}

	.hero,
	.metric,
	.panel {
		background: var(--vgv-surface);
	}

	.hero {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.82rem;
		font-weight: 800;
		color: var(--vgv-verde);
	}

	h1,
	h2 {
		margin: 0;
		color: var(--vgv-azul-oscuro);
	}

	.hero p,
	.panel p,
	.metric p {
		margin: 0.4rem 0 0;
		color: var(--vgv-gris);
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.metric strong {
		display: block;
		margin-top: 0.4rem;
		font-size: 1.35rem;
		color: var(--vgv-azul-oscuro);
	}

	.stacked {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.panel-actions {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.search-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.search-row label {
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
	}

	.search-row input {
		width: min(100%, 420px);
	}

	.logout,
	.refresh {
		border: none;
		border-radius: 999px;
		padding: 0.8rem 1rem;
		font-weight: 800;
		cursor: pointer;
		background: var(--vgv-azul);
		color: var(--vgv-blanco);
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}

	.logout:hover,
	.refresh:hover {
		transform: translateY(-1px);
		box-shadow: var(--vgv-shadow-md);
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

	.feedback.ok {
		background: rgba(76, 175, 80, 0.1);
		color: var(--vgv-verde-oscuro);
	}

	@media (max-width: 1000px) {
		.metrics-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 700px) {
		.hero,
		.panel-head {
			flex-direction: column;
			align-items: flex-start;
		}

		.metrics-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
