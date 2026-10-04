export const PRODUCT_IMAGE_PLACEHOLDER = '/assets/images/producto-sin-imagen.svg';

export class ProductSaveError extends Error {
	constructor(message, { status = 0, savedProduct = null, imageFailed = false } = {}) {
		super(message);
		this.status = status;
		this.savedProduct = savedProduct;
		this.imageFailed = imageFailed;
	}
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
	const response = await request(
		url(
			existingProduct?.id
				? `/admin/products/${encodeURIComponent(existingProduct.id)}`
				: '/admin/products'
		),
		{
			method: existingProduct?.id ? 'PUT' : 'POST',
			headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(body)
		}
	);
	const confirmedProduct = await readResponse(response);
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
