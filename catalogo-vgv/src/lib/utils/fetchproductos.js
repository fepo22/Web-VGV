import { normalizeFamiliaSlug } from '$lib/data/categorias.js';

export const PRODUCT_IMAGE_PLACEHOLDER = '/assets/images/producto-sin-imagen.svg';

function normalizeImagePath(image, { backendBase = '' } = {}) {
	const value = String(image ?? '').trim();
	if (!value) return PRODUCT_IMAGE_PLACEHOLDER;
	if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;

	if (value.startsWith('/api/product-images/')) {
		const normalizedBase = String(backendBase || '').replace(/\/$/, '');
		return normalizedBase ? `${normalizedBase}${value}` : value;
	}

	if (value.startsWith('/')) return value;
	return `/${value.replace(/^\/+/, '')}`;
}

export function mapProduct(producto, options = {}) {
	const rawStock = producto.stock;
	const parsedStock =
		rawStock === null || rawStock === undefined || rawStock === '' ? null : Number(rawStock);
	const variantes = Array.isArray(producto.variantes)
		? producto.variantes.map((variante) => ({
				...variante,
				sku: String(variante.sku || ''),
				medida: String(variante.medida || ''),
				minima: Math.max(1, Number(variante.minima ?? 1))
			}))
		: [];

	return {
		id: String(producto.id),
		codigo: String(producto.codigo || `VGV-${String(producto.id).padStart(4, '0')}`),
		nombre: producto.nombre,
		descripcion: producto.descripcion || '',
		imagen: normalizeImagePath(producto.imagen, options),
		relatedProductIds: Array.isArray(producto.relatedProductIds)
			? producto.relatedProductIds.map(String)
			: [],
		relatedProducts: Array.isArray(producto.relatedProducts)
			? producto.relatedProducts.map((relatedProduct) => mapProduct(relatedProduct, options))
			: [],
		familia: producto.familia || producto.categoria || 'Sin categoria',
		familiaSlug: normalizeFamiliaSlug(
			producto.familiaSlug || producto.categoriaSlug || 'sin-categoria'
		),
		subfamilia: producto.subfamilia || '',
		subfamiliaSlug: producto.subfamiliaSlug || '',
		categoria: producto.familia ? producto.categoria || '' : '',
		categoriaSlug: producto.familia ? producto.categoriaSlug || '' : '',
		stock:
			parsedStock !== null && Number.isFinite(parsedStock) && parsedStock >= 0 ? parsedStock : null,
		estado: String(producto.estado || 'disponible'),
		variantes
	};
}
