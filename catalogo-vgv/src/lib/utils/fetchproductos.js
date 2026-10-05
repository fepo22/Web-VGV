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
	const variantes = Array.isArray(producto.variantes)
		? producto.variantes
				.map((variante) => ({
					sku: String(variante.sku || ''),
					medida: String(variante.medida || ''),
					minima: Math.max(1, Number(variante.minima ?? 1))
				}))
				.filter((variante) => variante.sku && variante.medida)
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
		stock: Math.max(0, Number(producto.stock ?? 0)),
		estado: String(
			producto.estado || (Number(producto.stock ?? 0) > 0 ? 'disponible' : 'sin stock')
		),
		variantes
	};
}
