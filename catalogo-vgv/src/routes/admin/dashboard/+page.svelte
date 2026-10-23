<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount, tick } from 'svelte';
	import { io } from 'socket.io-client';
	import Loader from '$lib/components/Loader.svelte';
	import ProductForm from '$lib/components/ProductForm.svelte';
	import ImageBatchUpload from '$lib/components/ImageBatchUpload.svelte';
	import ProductTable from '$lib/components/ProductTable.svelte';
	import { familias } from '$lib/data/categorias.js';
	import { backendUrl, getBackendUrl } from '$lib/utils/backend-url.js';
	import { saveProductWithImage, shouldRefreshSavedProduct } from '$lib/utils/save-product.js';
	import { parseExcelNumber } from '$lib/utils/import-number.js';
	import {
		importRecoveryState,
		canResubmitRejectedImport,
		sendImportBatch
	} from '$lib/utils/import-recovery.js';

	const STORAGE_KEY = 'vgv_admin_token';

	let token = $state('');
	let products = $state([]);
	let loading = $state(true);
	let productsLoaded = false;
	let saving = $state(false);
	let actionLoadingId = $state('');
	let editingProduct = $state(null);
	let savedFormProduct = $state(null);
	let formSaveError = $state('');
	let formKey = $state(0);
	let showProductForm = $state(false);
	let lastAdded = $state('');
	let error = $state('');
	let notice = $state('');
	let searchTerm = $state('');
	let productStatus = $state('todos');
	let activeView = $state('cotizaciones');
	let productFormAnchor = $state();
	let quotations = $state([]);
	let quotationsError = $state('');
	let quotationsLoading = $state(true);
	let quotationsLoaded = false;
	let quoteStatus = $state('pendiente');
	let quoteSearchTerm = $state('');
	let changingStatusId = $state('');
	let importingProducts = $state(false);
	let bulkProgress = $state(0);
	let bulkTotal = $state(0);
	let pendingImport = $state(null);
	let importReport = $state(null);
	const importRecovery = $derived(importRecoveryState(pendingImport, importReport));
	const canResubmitImport = $derived(canResubmitRejectedImport(pendingImport, importReport));
	const IMPORT_RECEIPT_KEY = 'vgv-e0-pending-import';
	let bulkFileInput = $state();
	const statusLabels = {
		pendiente: 'Pendiente',
		cotizacion_enviada: 'Cotización enviada',
		confirmada: 'Confirmada',
		completada: 'Completada',
		desistida: 'Desistida'
	};
	const nextStatuses = {
		pendiente: ['cotizacion_enviada', 'desistida'],
		cotizacion_enviada: ['confirmada', 'desistida'],
		confirmada: ['completada']
	};

	let socket = null;
	let refreshTimer;

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
		return products.filter((product) => {
			if (productStatus !== 'todos' && product.estado !== productStatus) return false;
			if (!term) return true;
			const code = String(product.codigo || `VGV-${String(product.id ?? '').padStart(4, '0')}`)
				.toLowerCase()
				.trim();
			const name = String(product.nombre || '')
				.toLowerCase()
				.trim();
			return code.includes(term) || name.includes(term);
		});
	});

	const pendingQuotations = $derived(
		quotations.filter((quotation) => (quotation.estado || 'pendiente') === 'pendiente').length
	);
	const filteredQuotations = $derived.by(() => {
		const term = quoteSearchTerm.trim().toLowerCase();
		return quotations.filter((quotation) => {
			if (quoteStatus !== 'todas' && (quotation.estado || 'pendiente') !== quoteStatus)
				return false;
			return (
				!term ||
				[quotation.nombre, quotation.empresa, quotation.correo, quotation.rut].some((value) =>
					String(value || '')
						.toLowerCase()
						.includes(term)
				)
			);
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

		socket.on('connect_error', teardownSocket);

		socket.on('productAdded', (product) => {
			void loadProducts();
			lastAdded = product?.nombre || lastAdded;
			notice = `Producto agregado: ${product?.nombre || ''}`.trim();
		});

		socket.on('productUpdated', () => {
			// Public events omit cost and image events omit the version; reload the admin snapshot.
			void loadProducts();
		});

		socket.on('productDeleted', ({ id }) => {
			products = products.filter((product) => String(product.id) !== String(id));
			products = products.map((product) => ({
				...product,
				relatedProductIds: (product.relatedProductIds || []).filter(
					(relatedId) => String(relatedId) !== String(id)
				)
			}));
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
		try {
			pendingImport = JSON.parse(sessionStorage.getItem(IMPORT_RECEIPT_KEY) || 'null');
		} catch {
			error =
				'No se pudo recuperar la identidad de la importación; consulta el recibo antes de reenviar.';
		}
		if (!token) {
			goto(resolve('/admin/login'));
			return;
		}

		void loadProducts().finally(() => {
			setupSocket();
		});
		void loadQuotations();
		refreshTimer = window.setInterval(() => {
			void loadProducts();
			void loadQuotations();
		}, 30_000);
	});

	onDestroy(() => {
		teardownSocket();
		if (refreshTimer) window.clearInterval(refreshTimer);
	});

	function logout(message = '') {
		if (browser) {
			localStorage.removeItem(STORAGE_KEY);
		}
		teardownSocket();
		products = [];
		quotations = [];
		productsLoaded = false;
		quotationsLoaded = false;
		editingProduct = null;
		error = message;
		notice = '';
		goto(resolve('/admin/login'));
	}

	function startEditing(product) {
		if (saving) return;
		formKey += 1;
		formSaveError = '';
		savedFormProduct = null;
		activeView = 'productos';
		showProductForm = true;
		editingProduct = { ...product };
		error = '';
		notice = '';
		void tick().then(() =>
			productFormAnchor?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		);
	}

	function startCreating() {
		if (saving) return;
		formKey += 1;
		formSaveError = '';
		savedFormProduct = null;
		activeView = 'productos';
		editingProduct = null;
		showProductForm = true;
		error = '';
		void tick().then(() =>
			productFormAnchor?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		);
	}

	function cancelEditing() {
		if (saving) return;
		savedFormProduct = null;
		editingProduct = null;
		showProductForm = false;
	}

	async function loadQuotations() {
		if (!token) return;
		quotationsLoading = !quotationsLoaded;
		quotationsError = '';
		try {
			const response = await fetch(backendUrl('/api/cotizar'), {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (response.status === 401) {
				logout('Tu sesión expiró. Vuelve a iniciar sesión.');
				return;
			}
			if (!response.ok) throw new Error('No se pudieron cargar las cotizaciones.');
			quotations = await response.json();
		} catch (loadError) {
			quotationsError =
				loadError instanceof Error ? loadError.message : 'Error cargando cotizaciones.';
		} finally {
			quotationsLoading = false;
			quotationsLoaded = true;
		}
	}

	async function changeQuotationStatus(quotation, estado) {
		if (!estado || estado === (quotation.estado || 'pendiente')) return;
		if (
			estado === 'confirmada' &&
			!window.confirm('¿El cliente aceptó la cotización y ya se recibió el pago?')
		)
			return;
		if (estado === 'completada' && !window.confirm('¿El cliente ya recibió el pedido?')) return;
		if (estado === 'desistida' && !window.confirm('¿Marcar esta cotización como desistida?'))
			return;
		changingStatusId = quotation._id;
		quotationsError = '';
		try {
			const response = await fetch(backendUrl(`/api/cotizar/${quotation._id}/estado`), {
				method: 'PATCH',
				headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ estado })
			});
			if (response.status === 401) return logout('Tu sesión expiró. Vuelve a iniciar sesión.');
			const data = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(data.error || 'No se pudo cambiar el estado.');
			quotations = quotations.map((entry) => (entry._id === data._id ? data : entry));
		} catch (changeError) {
			quotationsError =
				changeError instanceof Error ? changeError.message : 'Error actualizando estado.';
		} finally {
			changingStatusId = '';
		}
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
			'familia',
			'subfamilia',
			'precio costo',
			'stock',
			'estado',
			'categoria'
		];
		const rows = products.map((product) => {
			const fallbackCode = `VGV-${String(product.id ?? '').padStart(4, '0')}`;

			return [
				product.codigo || fallbackCode,
				product.id,
				product.nombre,
				product.familia || product.categoria || '',
				product.subfamilia || '',
				Number(product.precioCosto ?? 0),
				product.stock ?? '',
				product.estado || 'disponible',
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

	function normalizeExcelLabel(value) {
		return String(value ?? '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
	}

	function excelCellValue(value) {
		if (value && typeof value === 'object') {
			if ('result' in value) return value.result;
			if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
			if ('text' in value) return value.text;
		}
		return value;
	}

	async function downloadBulkTemplate() {
		try {
			const ExcelJS = (await import('exceljs')).default;
			const workbook = new ExcelJS.Workbook();
			const sheet = workbook.addWorksheet('Productos');
			sheet.addRow([
				'CODIGO',
				'NOMBRE DEL PRODUCTO',
				'FAMILIA',
				'SUBFAMILIA',
				'CATEGORIA',
				'PRECIO COSTO',
				'STOCK'
			]);
			sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
			sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF174B3A' } };
			sheet.columns = [
				{ width: 20 },
				{ width: 34 },
				{ width: 28 },
				{ width: 28 },
				{ width: 26 },
				{ width: 18 }
			];
			sheet.views = [{ state: 'frozen', ySplit: 1 }];
			const buffer = await workbook.xlsx.writeBuffer();
			const blob = new Blob([buffer], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'plantilla-productos-vgv.xlsx';
			link.click();
			URL.revokeObjectURL(url);
		} catch (templateError) {
			error =
				templateError instanceof Error
					? templateError.message
					: 'No se pudo generar la plantilla Excel.';
		}
	}

	function persistPendingImport(pending) {
		sessionStorage.setItem(IMPORT_RECEIPT_KEY, JSON.stringify(pending));
		pendingImport = pending;
	}

	async function reconcileImport(retry = false, resubmit = false) {
		if (!pendingImport || importingProducts) return;
		if (resubmit && !canResubmitImport) return;
		if (retry && !importRecovery.canRetry) return;
		importingProducts = true;
		try {
			const retryRows = retry ? importRecovery.retryRows : undefined;
			if (
				retry &&
				!window.confirm(
					'Reintentar solo las filas no aplicadas conocidas, sin repetir confirmadas ni ambiguas?'
				)
			)
				return;
			if (
				resubmit &&
				!window.confirm(
					'La solicitud fue rechazada antes de importar. ¿Reenviar el mismo lote con su batchId original?'
				)
			)
				return;
			let response;
			let report;
			if (retry || resubmit) {
				const result = await sendImportBatch({
					pending: pendingImport,
					retryRows,
					token,
					url: backendUrl,
					persist: persistPendingImport
				});
				response = result.response;
				report = result.data;
			} else {
				response = await fetch(
					backendUrl(`/admin/products/bulk/${encodeURIComponent(pendingImport.batchId)}`),
					{
						headers: { Authorization: `Bearer ${token}` }
					}
				);
				report = await response.json();
			}
			if ([401, 403].includes(response.status))
				return logout(
					'Tu sesión expiró o no tiene acceso. Vuelve a iniciar sesión; se conserva el lote.'
				);
			if (response.status === 404)
				throw new Error(
					'No se encontró el recibo. Esto no confirma ausencia de cambios. Solo una solicitud con rechazo previo acreditado puede reenviarse con el mismo batchId.'
				);
			if (!response.ok) throw new Error(report.error || 'No se pudo consultar el lote.');
			if (report.batchId !== pendingImport.batchId || !Array.isArray(report.rows))
				throw new Error(
					'El servidor no confirmó el recibo solicitado. No reintentes una operación ambigua.'
				);
			importReport = report;
			persistPendingImport({
				...pendingImport,
				submission: report.complete ? 'confirmed' : 'started'
			});
			if (report.complete) {
				sessionStorage.removeItem(IMPORT_RECEIPT_KEY);
				pendingImport = null;
			}
			await loadProducts({ throwOnError: true });
			notice = report.complete
				? 'Lote confirmado; no se repitieron filas confirmadas.'
				: 'Lote parcial: revisa cada fila antes de continuar.';
		} catch (failure) {
			error = failure instanceof Error ? failure.message : 'No se pudo reconciliar el lote.';
		} finally {
			importingProducts = false;
		}
	}

	function archiveImport() {
		if (!importRecovery.canArchive) return;
		if (
			!window.confirm(
				'Conservar el batchId del informe y cerrar este lote revisado? Un archivo corregido será una operación nueva; no reenviar filas confirmadas.'
			)
		)
			return;
		sessionStorage.removeItem(IMPORT_RECEIPT_KEY);
		pendingImport = null;
	}

	async function importProductsFromExcel(event) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;
		if (pendingImport) {
			error = `Hay un lote pendiente (${pendingImport.batchId}); consulta su estado antes de importar otro archivo.`;
			input.value = '';
			return;
		}
		importingProducts = true;
		bulkProgress = 0;
		bulkTotal = 0;
		error = '';
		notice = '';
		const rowErrors = [];
		let created = 0;
		let updated = 0;

		try {
			if (!file.name.toLowerCase().endsWith('.xlsx')) {
				throw new Error('Selecciona un archivo .xlsx.');
			}
			if (file.size > 5 * 1024 * 1024) {
				throw new Error('El archivo Excel no puede superar 5 MB.');
			}
			const ExcelJS = (await import('exceljs')).default;
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(await file.arrayBuffer());
			const sheet = workbook.worksheets[0];
			if (!sheet || sheet.rowCount < 2 || sheet.rowCount > 5001) {
				throw new Error('El Excel debe incluir datos y no superar 5.000 filas.');
			}

			const headerIndexes = {};
			sheet.getRow(1).eachCell((cell, column) => {
				headerIndexes[normalizeExcelLabel(excelCellValue(cell.value))] = column;
			});
			const headerAliases = {
				codigo: ['codigo', 'code', 'sku'],
				nombre: ['nombre del producto', 'nombre'],
				familia: ['familia'],
				subfamilia: ['subfamilia'],
				categoria: ['categoria'],
				precioCosto: ['precio costo', 'precio de costo', 'preciocosto'],
				stock: ['stock']
			};
			const columns = Object.fromEntries(
				Object.entries(headerAliases).map(([key, aliases]) => [
					key,
					aliases
						.map(normalizeExcelLabel)
						.map((alias) => headerIndexes[alias])
						.find(Boolean)
				])
			);
			const missingHeaders = Object.entries(columns)
				.filter(([key, column]) => key === 'codigo' && !column)
				.map(([key]) => key);
			if (missingHeaders.length) {
				throw new Error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}.`);
			}

			const rows = [];
			const seenCodes = Object.create(null);
			for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
				const row = sheet.getRow(rowNumber);
				const value = (key) =>
					columns[key] ? excelCellValue(row.getCell(columns[key]).value) : '';
				const codigo = String(value('codigo') ?? '')
					.trim()
					.toUpperCase();
				const nombre = String(value('nombre') ?? '').trim();
				const familiaNombre = String(value('familia') ?? '').trim();
				const subfamiliaNombre = String(value('subfamilia') ?? '').trim();
				const categoriaNombre = String(value('categoria') ?? '').trim();
				const rawCost = value('precioCosto');
				const rawStock = value('stock');
				if (
					![
						codigo,
						nombre,
						familiaNombre,
						subfamiliaNombre,
						categoriaNombre,
						rawCost,
						rawStock
					].some((item) => String(item ?? '').trim())
				)
					continue;

				try {
					if (!codigo) throw new Error('El código es obligatorio para identificar el producto.');
					if (!/^[A-Z0-9_-]+$/.test(codigo.replace(/\s+/g, '-'))) {
						throw new Error(
							'El código no puede contener caracteres que se descarten al identificar el producto.'
						);
					}
					const normalizedCode = codigo.replace(/\s+/g, '-').replace(/[^A-Z0-9-_]/g, '');
					if (Object.hasOwn(seenCodes, normalizedCode)) {
						throw new Error('Código duplicado dentro del archivo.');
					}
					seenCodes[normalizedCode] = true;
					const existing = products.find(
						(product) =>
							String(product.codigo ?? '')
								.trim()
								.toUpperCase()
								.replace(/\s+/g, '-')
								.replace(/[^A-Z0-9-_]/g, '') === normalizedCode
					);
					const existingFamily =
						existing &&
						familias.find((item) => item.slug === (existing.familiaSlug || existing.categoriaSlug));
					const family = familiaNombre
						? familias.find(
								(item) => normalizeExcelLabel(item.nombre) === normalizeExcelLabel(familiaNombre)
							)
						: existingFamily;
					if (familiaNombre && !family) throw new Error(`Familia no válida: ${familiaNombre}.`);

					const existingSubfamily =
						existing && family?.subfamilias.find((item) => item.slug === existing.subfamiliaSlug);
					const subfamily = subfamiliaNombre
						? family?.subfamilias.find(
								(item) => normalizeExcelLabel(item.nombre) === normalizeExcelLabel(subfamiliaNombre)
							)
						: existingSubfamily;
					if (subfamiliaNombre && !subfamily) {
						throw new Error(
							`Subfamilia no válida para ${family?.nombre || 'la familia indicada'}.`
						);
					}

					const category = categoriaNombre
						? subfamily?.categorias?.find(
								(item) => normalizeExcelLabel(item.nombre) === normalizeExcelLabel(categoriaNombre)
							)
						: null;
					if (categoriaNombre && !category) {
						throw new Error(
							`Categoría no válida para ${subfamily?.nombre || 'la subfamilia indicada'}.`
						);
					}
					if (subfamily?.categorias?.length && subfamiliaNombre && !categoriaNombre && !existing) {
						throw new Error(`Selecciona una categoría válida para ${subfamily.nombre}.`);
					}

					const rowPayload = { rowNumber, codigo };
					if (nombre) rowPayload.nombre = nombre;
					if (familiaNombre && family) {
						rowPayload.familia = family.nombre;
						rowPayload.familiaSlug = family.slug;
					}
					if (subfamiliaNombre && subfamily) {
						rowPayload.subfamilia = subfamily.nombre;
						rowPayload.subfamiliaSlug = subfamily.slug;
					}
					if (categoriaNombre && category) {
						rowPayload.categoria = category.nombre;
						rowPayload.categoriaSlug = category.slug;
					}
					if (String(rawCost ?? '').trim()) {
						const precioCosto = parseExcelNumber(rawCost);
						if (!Number.isFinite(precioCosto) || precioCosto < 0)
							throw new Error('Precio costo debe ser un número igual o mayor a cero.');
						rowPayload.precioCosto = precioCosto;
					}
					if (String(rawStock ?? '').trim()) {
						const stock = parseExcelNumber(rawStock);
						if (!Number.isFinite(stock) || stock < 0)
							throw new Error('Stock debe ser un número igual o mayor a cero.');
						rowPayload.stock = stock;
					}
					if (
						!existing &&
						(!rowPayload.nombre ||
							!rowPayload.familia ||
							!rowPayload.subfamilia ||
							!Object.hasOwn(rowPayload, 'precioCosto'))
					) {
						throw new Error(
							'Para productos nuevos completa nombre, familia, subfamilia y precio costo.'
						);
					}
					rows.push(rowPayload);
				} catch (rowError) {
					rowErrors.push({
						row: rowNumber,
						message: rowError instanceof Error ? rowError.message : 'Fila inválida.'
					});
				}
			}
			if (!rows.length) {
				const details = rowErrors
					.slice(0, 12)
					.map((item) => `Fila ${item.row}: ${item.message}`)
					.join('\n');
				throw new Error(details || 'No hay filas válidas para importar.');
			}
			bulkTotal = rows.length;

			for (let start = 0; start < rows.length; start += 100) {
				importReport = null;
				persistPendingImport({
					batchId: crypto.randomUUID(),
					products: rows.slice(start, start + 100),
					submission: 'notSent'
				});
				const { response, data } = await sendImportBatch({
					pending: pendingImport,
					token,
					url: backendUrl,
					persist: persistPendingImport
				});
				if ([401, 403].includes(response.status))
					return logout(
						'Tu sesión expiró o no tiene acceso. Vuelve a iniciar sesión; se conserva el lote.'
					);
				if (!response.ok) throw new Error(data.error || 'No se pudo importar el lote.');
				if (data.batchId !== pendingImport.batchId || !Array.isArray(data.rows))
					throw new Error(
						'El servidor no confirmó el recibo solicitado. Consulta el lote antes de continuar.'
					);
				importReport = data;
				created += Number(data.created ?? 0);
				updated += Number(data.updated ?? 0);
				rowErrors.push(...(data.errors ?? []));
				bulkProgress = Math.min(start + 100, rows.length);
				if (!data.complete)
					throw new Error(
						`Lote ${data.batchId} parcial: consulta las filas confirmadas, fallidas o desconocidas. No se enviaron los lotes siguientes.`
					);
				sessionStorage.removeItem(IMPORT_RECEIPT_KEY);
				pendingImport = null;
			}

			await loadProducts();
			notice = `Importación completada: ${created} nuevos y ${updated} actualizados.`;
			if (rowErrors.length) {
				error = rowErrors
					.slice(0, 12)
					.map((item) => `Fila ${item.row}: ${item.message}`)
					.join('\n');
				if (rowErrors.length > 12) error += `\nY ${rowErrors.length - 12} errores más.`;
			}
		} catch (importError) {
			error =
				importError instanceof Error ? importError.message : 'No se pudo leer el archivo Excel.';
			if (bulkTotal > 0) {
				const importMessage = `${error} La importación puede ser parcial; no reintentes automáticamente. Lotes confirmados: ${created} nuevos y ${updated} actualizados.`;
				try {
					await loadProducts({ throwOnError: true });
					error = `${importMessage} La lista se actualizó para revisar el resultado.`;
				} catch {
					error = `${importMessage} No se pudo actualizar la lista; recarga el panel antes de continuar.`;
				}
			}
		} finally {
			importingProducts = false;
			input.value = '';
		}
	}

	async function loadProducts({ throwOnError = false } = {}) {
		if (!token) return;

		loading = !productsLoaded;
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
				if (throwOnError) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
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
			if (throwOnError) throw loadError;
		} finally {
			loading = false;
			productsLoaded = true;
		}
	}

	async function saveProduct(payload, image = null) {
		if (!token) {
			formSaveError = 'Debes iniciar sesión nuevamente.';
			error = formSaveError;
			return { success: false };
		}
		if (saving) return { success: false };

		saving = true;
		formSaveError = '';
		error = '';
		notice = '';
		const existingProduct = savedFormProduct || editingProduct;

		try {
			const data = await saveProductWithImage({
				payload,
				image,
				existingProduct,
				token,
				url: backendUrl,
				onProductSaved: upsertProduct
			});

			upsertProduct(data);
			if (!existingProduct?.id) {
				lastAdded = data?.nombre || lastAdded;
			}

			notice = image
				? 'Producto e imagen guardados correctamente.'
				: existingProduct?.id
					? 'Producto actualizado correctamente.'
					: 'Producto creado correctamente.';
			savedFormProduct = null;
			editingProduct = null;
			showProductForm = false;
			return { success: true };
		} catch (saveError) {
			let recoveryWarning = '';
			if (shouldRefreshSavedProduct(saveError)) {
				savedFormProduct = saveError.savedProduct;
				// A network error may follow an image commit. Refresh before asking to retry.
				try {
					const response = await fetch(
						backendUrl(`/admin/products/${encodeURIComponent(savedFormProduct.id)}`),
						{
							headers: { Authorization: `Bearer ${token}` }
						}
					);
					if (!response.ok)
						throw new Error('No se pudo consultar la imagen actual.', { cause: saveError });
					const refreshedProduct = await response.json();
					if (String(refreshedProduct?.id) !== String(savedFormProduct.id)) {
						throw new Error('El servidor no confirmó el producto solicitado.', {
							cause: saveError
						});
					}
					savedFormProduct = { ...savedFormProduct, imagen: refreshedProduct.imagen };
					upsertProduct(refreshedProduct);
				} catch {
					recoveryWarning =
						' No se pudo confirmar la imagen actual; revisa la ficha antes de reintentar.';
				}
			}
			if ([409, 428].includes(saveError?.status) && !saveError.imageFailed) {
				formSaveError =
					saveError.status === 409
						? 'La ficha cambió desde que la abriste. Copia tus cambios, cancela la edición y vuelve a abrir el producto actualizado antes de guardarlos.'
						: 'El servidor requiere una versión actual de la ficha. No se aplicaron estos cambios; cancela la edición y vuelve a abrir el producto antes de reintentar.';
				error = formSaveError;
				try {
					await loadProducts({ throwOnError: true });
				} catch {
					formSaveError += ' No se pudo actualizar la lista; recarga el panel antes de reintentar.';
					error = formSaveError;
				}
				return { success: false };
			}
			if ([401, 403].includes(saveError?.status)) {
				logout('Tu sesión expiró o no tiene acceso. Vuelve a iniciar sesión.');
				return { success: false };
			}
			formSaveError = saveError instanceof Error ? saveError.message : 'Error guardando producto.';
			formSaveError += recoveryWarning;
			error = formSaveError;
			return { success: false, imageFailed: Boolean(saveError?.imageFailed) };
		} finally {
			saving = false;
		}
	}

	async function toggleStatus(product) {
		if (saving) return;
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
				body: JSON.stringify({
					estado: nextStatus,
					_expectedUpdatedAt: product.updatedAt ?? null
				})
			});

			if (response.status === 401) {
				logout('Tu sesión expiró. Vuelve a iniciar sesión.');
				return;
			}

			const data = await response.json().catch(() => ({}));
			if ([409, 428].includes(response.status)) {
				const conflictMessage = data?.error || 'El producto cambió desde que lo cargaste.';
				try {
					await loadProducts({ throwOnError: true });
					error =
						response.status === 409
							? `${conflictMessage} La lista se actualizó; vuelve a intentarlo sobre el producto actual.`
							: 'El servidor requiere una versión actual. La lista se actualizó; vuelve a cambiar el estado sobre el producto actual.';
				} catch {
					error = `${conflictMessage} No se pudo actualizar la lista; recarga el panel antes de reintentar.`;
				}
				return;
			}
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
		if (saving) return;
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
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="admin-shell">
	<header class="hero card">
		<div>
			<p class="eyebrow">Panel de administración</p>
			<h1>Dashboard VGV</h1>
			<p>Productos y cotizaciones actualizados periódicamente.</p>
		</div>
		<button
			class="logout"
			type="button"
			disabled={saving}
			onclick={() => logout('Sesión cerrada correctamente.')}>Cerrar sesión</button
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
				<p>Cotizaciones pendientes</p>
				<strong>{pendingQuotations}</strong>
			</article>
		</section>

		<div class="view-tabs" role="group" aria-label="Secciones de administración">
			<button
				type="button"
				disabled={saving}
				aria-pressed={activeView === 'cotizaciones'}
				class:active={activeView === 'cotizaciones'}
				onclick={() => (activeView = 'cotizaciones')}>Cotizaciones</button
			>
			<button
				type="button"
				disabled={saving}
				aria-pressed={activeView === 'productos'}
				class:active={activeView === 'productos'}
				onclick={() => (activeView = 'productos')}>Productos</button
			>
			<button
				type="button"
				disabled={saving}
				aria-pressed={activeView === 'imagenes'}
				class:active={activeView === 'imagenes'}
				onclick={() => (activeView = 'imagenes')}>Importar imágenes</button
			>
		</div>
		<section class="stacked">
			{#if activeView === 'cotizaciones'}
				<section class="panel card">
					<div class="panel-head">
						<div>
							<h2>Cotizaciones solicitadas</h2>
							<p>{filteredQuotations.length} de {quotations.length} solicitudes.</p>
						</div>
						<button class="refresh" type="button" onclick={loadQuotations}>Actualizar</button>
					</div>
					<div class="quote-filters">
						<label for="quote-status"
							>Estado
							<select id="quote-status" bind:value={quoteStatus}>
								<option value="pendiente">Pendientes ({pendingQuotations})</option>
								<option value="todas">Todas</option>
								{#each Object.entries(statusLabels).filter(([key]) => key !== 'pendiente') as [key, label] (key)}
									<option value={key}>{label}</option>
								{/each}
							</select>
						</label>
						<label for="quote-search"
							>Buscar
							<input
								id="quote-search"
								type="search"
								placeholder="Cliente, empresa, correo o RUT"
								bind:value={quoteSearchTerm}
							/>
						</label>
					</div>
					{#if quotationsError}<p class="feedback error">{quotationsError}</p>{/if}
					{#if quotationsLoading}<Loader
						/>{:else if filteredQuotations.length === 0 && !quotationsError}<p>
							Sin cotizaciones para este filtro.
						</p>{/if}
					<div class="quotation-list">
						{#each filteredQuotations as quotation (quotation._id)}
							<details class="quotation">
								<summary
									><strong>{quotation.nombre}</strong><span
										>{quotation.empresa || quotation.tipoCliente || 'Cliente'}</span
									><span class="quote-state">{statusLabels[quotation.estado || 'pendiente']}</span
									><time datetime={quotation.createdAt}
										>{new Date(quotation.createdAt).toLocaleDateString('es-CL')}</time
									></summary
								>
								<div>
									<a href={`mailto:${quotation.correo}`}>{quotation.correo}</a> · {quotation.contacto}
									· RUT {quotation.rut}
								</div>
								<div>Despacho: {quotation.direccion}</div>
								<ul>
									{#each quotation.productos as producto, position (position)}<li>
											{producto.nombre} · {producto.varianteSku || producto.id} × {producto.cantidad}
										</li>{/each}
								</ul>
								<label class="quotation-status"
									>Estado
									<select
										value={quotation.estado || 'pendiente'}
										disabled={changingStatusId === quotation._id}
										onchange={(event) => {
											const nextStatus = event.currentTarget.value;
											event.currentTarget.value = quotation.estado || 'pendiente';
											void changeQuotationStatus(quotation, nextStatus);
										}}
									>
										<option value={quotation.estado || 'pendiente'}
											>{statusLabels[quotation.estado || 'pendiente']}</option
										>
										{#each nextStatuses[quotation.estado || 'pendiente'] || [] as nextStatus (nextStatus)}
											<option value={nextStatus}>{statusLabels[nextStatus]}</option>
										{/each}
									</select>
								</label>
							</details>
						{/each}
					</div>
				</section>
			{:else if activeView === 'imagenes'}
				<div class="panel-actions">
					<button class="refresh" type="button" onclick={loadProducts}>Actualizar productos</button>
				</div>
				{#if error}<p class="feedback error" role="alert">{error}</p>{/if}
				<ImageBatchUpload
					{products}
					{token}
					onuploaded={(product) => upsertProduct(product)}
					onautherror={() => logout('Tu sesión expiró o no tiene acceso. Vuelve a iniciar sesión.')}
					onrefresh={() => loadProducts({ throwOnError: true })}
				/>
			{:else}
				{#if showProductForm}
					<div bind:this={productFormAnchor} class="form-anchor">
						{#key formKey}
							<ProductForm
								product={editingProduct}
								{products}
								loading={saving}
								saveError={formSaveError}
								savedProduct={savedFormProduct}
								onSubmit={saveProduct}
								onCancel={cancelEditing}
							/>
						{/key}
					</div>
				{/if}

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
							<button class="refresh" type="button" onclick={startCreating}>Nuevo producto</button>
							<button class="refresh" type="button" onclick={downloadBulkTemplate}
								>Plantilla Excel</button
							>
							<button
								class="refresh"
								type="button"
								disabled={importingProducts}
								onclick={() => bulkFileInput?.click()}
							>
								{importingProducts
									? bulkTotal
										? `Importando ${bulkProgress}/${bulkTotal}...`
										: 'Preparando Excel...'
									: 'Subir Excel'}
							</button>
							<button class="refresh" type="button" onclick={loadProducts}>Refrescar</button>
							<button class="refresh" type="button" onclick={exportProductsCsv}>Exportar CSV</button
							>
						</div>
					</div>
					<input
						bind:this={bulkFileInput}
						class="bulk-file-input"
						type="file"
						accept=".xlsx"
						onchange={importProductsFromExcel}
					/>

					<div class="search-row">
						<label for="product-search"
							>Buscar por código o nombre
							<input
								id="product-search"
								type="search"
								placeholder="Ej: VGV-0049 o Codo 90"
								bind:value={searchTerm}
							/>
						</label>
						<label for="product-status"
							>Disponibilidad
							<select id="product-status" bind:value={productStatus}>
								<option value="todos">Todos</option>
								<option value="disponible">Disponibles</option>
								<option value="sin stock">Sin stock</option>
							</select>
						</label>
					</div>

					{#if error}
						<p class="feedback error">{error}</p>
					{/if}

					{#if notice}
						<p class="feedback ok">{notice}</p>
					{/if}
					{#if pendingImport || importReport}
						<section aria-label="Reconciliación de importación">
							<p>Lote: {pendingImport?.batchId || importReport?.batchId}</p>
							{#if pendingImport}
								<p role="status">
									{pendingImport.submission === 'rejected'
										? 'Solicitud rechazada antes del controlador. Se conserva la identidad para un reenvío explícito.'
										: 'Conserva este batchId. Un recibo ausente no confirma que no hubo cambios; consulta antes de actuar.'}
								</p>
								{#if canResubmitImport}
									<button
										type="button"
										disabled={importingProducts}
										onclick={() => reconcileImport(false, true)}
										>Reenviar solicitud rechazada con el mismo batchId</button
									>
								{/if}
								<button type="button" disabled={importingProducts} onclick={() => reconcileImport()}
									>Consultar recibo</button
								>
								<button
									type="button"
									disabled={importingProducts || !importRecovery.canRetry}
									onclick={() => reconcileImport(true)}
									>Reintentar solo filas no aplicadas conocidas</button
								>
								<button
									type="button"
									disabled={importingProducts || !importRecovery.canArchive}
									onclick={archiveImport}>Cerrar lote revisado</button
								>
							{/if}
							{#if importReport}
								<p>
									Recibidas: {importReport.received}; confirmadas: {importReport.confirmed};
									rechazadas: {importReport.rejected}; fallidas: {importReport.failed}; conflictos: {importReport.conflicts};
									desconocidas: {importReport.unknown}; no intentadas: {importReport.unattempted}.
								</p>
								<ul>
									{#each importReport.rows as row (row.position)}
										<li>
											Fila {row.rowNumber} · {row.codigo || 'sin código'} · {row.status} · {row.productId ||
												'sin ID'} · {row.message || row.action}
										</li>
									{/each}
								</ul>
							{/if}
						</section>
					{/if}

					{#if filteredProducts.length === 0}
						<p>No hay productos para esta búsqueda.</p>
					{:else}
						<ProductTable
							products={filteredProducts}
							loadingId={actionLoadingId}
							onEdit={startEditing}
							onToggleStatus={toggleStatus}
							onDelete={deleteProduct}
						/>
					{/if}
				</section>
			{/if}
		</section>
	{/if}
</section>

<style>
	.view-tabs {
		display: flex;
		gap: 0.3rem;
		border-bottom: 1px solid var(--vgv-border-soft);
	}
	.view-tabs {
		flex-wrap: wrap;
	}
	.view-tabs button {
		border: none;
		border-bottom: 3px solid transparent;
		background: transparent;
		color: var(--vgv-azul-oscuro);
		padding: 0.8rem 1.1rem;
		font-weight: 700;
		cursor: pointer;
	}
	.view-tabs button.active {
		border-color: var(--vgv-verde);
	}
	.form-anchor {
		scroll-margin-top: 1rem;
	}
	.quotation-list {
		display: grid;
	}
	.quotation {
		border-bottom: 1px solid #d9e5f2;
		padding: 0.85rem 0;
		overflow-wrap: anywhere;
	}
	.quotation summary {
		display: grid;
		grid-template-columns: minmax(10rem, 1.4fr) minmax(8rem, 1fr) auto auto;
		align-items: center;
		gap: 0.8rem;
		cursor: pointer;
	}
	.quotation summary strong {
		color: var(--vgv-azul-oscuro);
	}
	.quotation summary time {
		color: var(--vgv-gris);
		white-space: nowrap;
	}
	.quote-state {
		color: var(--vgv-verde-oscuro);
		font-weight: 700;
	}
	.quotation div {
		margin: 0.55rem 0;
	}
	.quotation ul {
		margin: 0.25rem 0;
	}
	.quotation-status {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-weight: 700;
	}
	.quote-filters {
		display: grid;
		grid-template-columns: minmax(170px, 220px) minmax(220px, 1fr);
		gap: 1rem;
	}
	.quote-filters label {
		display: grid;
		gap: 0.4rem;
		font-weight: 700;
	}
	.quote-filters input,
	.quote-filters select {
		width: 100%;
		min-width: 0;
	}
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
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(180px, 220px);
		gap: 1rem;
	}

	.search-row label {
		display: grid;
		gap: 0.4rem;
		font-weight: 700;
		color: var(--vgv-azul-oscuro);
	}

	.search-row input,
	.search-row select {
		width: 100%;
		min-width: 0;
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

	.bulk-file-input {
		display: none;
	}
	.feedback.error {
		white-space: pre-line;
	}

	@media (max-width: 1000px) {
		.metrics-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 700px) {
		.quote-filters {
			grid-template-columns: 1fr;
		}
		.quotation summary {
			grid-template-columns: 1fr auto;
		}
		.search-row {
			grid-template-columns: 1fr;
		}
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
