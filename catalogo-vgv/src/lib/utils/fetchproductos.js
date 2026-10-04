import { normalizeFamiliaSlug } from '$lib/data/categorias.js';

export function mapProduct(producto) {
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
		imagen: producto.imagen || '/images/placeholder.png',
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
