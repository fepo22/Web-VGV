export const PRODUCT_IMAGE_PLACEHOLDER = '/assets/images/producto-sin-imagen.svg';

export class ProductSaveError extends Error {
	constructor(message, { status = 0, savedProduct = null, imageFailed = false } = {}) {
		super(message);
		this.status = status;
		this.savedProduct = savedProduct;
		this.imageFailed = imageFailed;
	}
}

export function shouldRefreshSavedProduct(error) {
	return Boolean(error?.savedProduct && (error.imageFailed || !error.status));
}

export function buildStockPatch(product, value) {
	const normalize = (stock) => {
		if (stock == null || (typeof stock === 'string' && stock.trim() === '')) return null;
		if (
			!['string', 'number'].includes(typeof stock) ||
			!Number.isFinite(Number(stock)) ||
			Number(stock) < 0
		) {
			throw new Error('Stock debe ser un número válido mayor o igual a cero, o quedar vacío.');
		}
		return Number(stock);
	};
	const stock = normalize(value);
	return product
		? normalize(product.stock) === stock
			? {}
			: { stock }
		: stock === null
			? {}
			: { stock };
}

function comparableProductField(product, field) {
	switch (field) {
		case 'familia':
			return product.familia || product.categoria || 'Sin categoria';
		case 'familiaSlug':
			return product.familiaSlug || product.categoriaSlug || 'sin-categoria';
		case 'subfamilia':
		case 'subfamiliaSlug':
		case 'descripcion':
			return product[field] || '';
		case 'categoria':
		case 'categoriaSlug':
			return product.familia ? product[field] || '' : '';
		case 'precioCosto':
			return Number(product.precioCosto ?? 0);
		case 'estado':
			return product.estado || 'disponible';
		case 'relatedProductIds':
			return Array.isArray(product.relatedProductIds) ? product.relatedProductIds.map(String) : [];
		case 'variantes':
			return Array.isArray(product.variantes)
				? product.variantes.map((variant) => ({
						sku: String(variant.sku || ''),
						medida: String(variant.medida || ''),
						minima: Number(variant.minima ?? 1)
					}))
				: [];
		case 'stock':
			return product.stock ?? null;
		default:
			return product[field] ?? '';
	}
}

export function buildProductPatch(currentProduct, draft) {
	return Object.fromEntries(
		Object.entries(draft).filter(([field, value]) => {
			return (
				JSON.stringify(comparableProductField(currentProduct, field)) !== JSON.stringify(value)
			);
		})
	);
}

async function readResponse(response) {
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new ProductSaveError(data?.error || 'No se pudo guardar el producto.', {
			status: response.status
		});
	}
	return data;
}

// Files always travel separately as multipart; they never enter the product JSON.
// A confirmed product is returned on image failure so a retry updates the same ID.
export async function saveProductWithImage({
	payload,
	image = null,
	existingProduct = null,
	token,
	url,
	request = fetch,
	onProductSaved = () => {}
}) {
	const body = { ...payload };
	if (image) {
		if (existingProduct?.id) delete body.imagen;
		else body.imagen = PRODUCT_IMAGE_PLACEHOLDER;
	}
	const hasMetadataChanges = Object.keys(body).length > 0;
	const requestBody = existingProduct?.id
		? { ...body, _expectedUpdatedAt: existingProduct.updatedAt ?? null }
		: body;
	if (existingProduct?.id && !hasMetadataChanges && !image) {
		await onProductSaved(existingProduct);
		return existingProduct;
	}
	const response =
		existingProduct?.id && !hasMetadataChanges
			? null
			: await request(
					url(
						existingProduct?.id
							? `/admin/products/${encodeURIComponent(existingProduct.id)}`
							: '/admin/products'
					),
					{
						method: existingProduct?.id ? 'PUT' : 'POST',
						headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
						body: JSON.stringify(requestBody)
					}
				);
	let confirmedProduct = existingProduct;
	if (response) {
		try {
			confirmedProduct = await readResponse(response);
		} catch (error) {
			if (existingProduct?.id && error instanceof ProductSaveError) {
				error.savedProduct = existingProduct;
			}
			throw error;
		}
		if (existingProduct?.id && String(confirmedProduct?.id) !== String(existingProduct.id)) {
			throw new ProductSaveError(
				'El backend no confirmó el producto solicitado. Actualiza la lista antes de reintentar.',
				{ savedProduct: existingProduct }
			);
		}
		if (!confirmedProduct?.id || !confirmedProduct.imagen) {
			throw new ProductSaveError(
				'El backend no confirmó un producto válido. Actualiza la lista antes de reintentar.',
				{
					savedProduct: confirmedProduct?.id
						? { ...existingProduct, ...body, ...confirmedProduct }
						: existingProduct
				}
			);
		}
	}
	const savedProduct = { ...existingProduct, ...body, ...confirmedProduct };
	try {
		await onProductSaved(savedProduct);
	} catch (error) {
		throw new ProductSaveError(
			`La ficha quedó guardada, pero no se pudo actualizar el panel: ${error?.message || 'error inesperado'}. Reintenta sobre este mismo producto.`,
			{ savedProduct, imageFailed: Boolean(image) }
		);
	}
	if (!image) return savedProduct;

	try {
		const expectedImage = existingProduct?.imagen ?? savedProduct.imagen;
		const multipart = new FormData();
		multipart.append('productId', String(savedProduct.id));
		multipart.append('expectedImage', expectedImage);
		multipart.append('overwrite', String(Boolean(expectedImage)));
		multipart.append('image', image, 'product.webp');
		const upload = await request(url('/admin/products/images'), {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` },
			body: multipart
		});
		const result = await readResponse(upload);
		if (!result?.product?.imagen || String(result.product.id) !== String(savedProduct.id)) {
			throw new Error('El servidor no confirmó la asociación de la imagen.');
		}
		return { ...savedProduct, ...result.product };
	} catch (error) {
		throw new ProductSaveError(
			`La ficha quedó guardada, pero la imagen no pudo confirmarse: ${error?.message || 'error de red'}. Revisa la imagen actual y reintenta; no se creará otro producto.`,
			{ status: error?.status, savedProduct, imageFailed: true }
		);
	}
}
