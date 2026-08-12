import { env } from '$env/dynamic/private';
import { productos as productosFallback } from '$lib/data/productos.js';

const BACKEND_URL = (env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:3000').replace(
	/\/$/,
	''
);

function mapProduct(producto) {
	const variantes = Array.isArray(producto.variantes)
		? producto.variantes
				.map((variante) => ({
					sku: String(variante.sku || ''),
					medida: String(variante.medida || ''),
					precio: Number(variante.precio ?? 0),
					minima: Math.max(1, Number(variante.minima ?? 1))
				}))
				.filter((variante) => variante.sku && variante.medida)
		: [];

	return {
		id: String(producto.id),
		codigo: String(producto.codigo || `VGV-${String(producto.id).padStart(4, '0')}`),
		nombre: producto.nombre,
		precio: Number(producto.precio ?? 0),
		descripcion: producto.descripcion || '',
		imagen: producto.imagen || '/images/placeholder.png',
		categoria: producto.categoria || producto.categoriaSlug || 'Sin categoria',
		categoriaSlug: producto.categoriaSlug || producto.categoria || 'sin-categoria',
		oferta: Boolean(producto.oferta),
		descuentoPct: Number.isFinite(Number(producto.descuentoPct))
			? Number(producto.descuentoPct)
			: null,
		variantes
	};
}

export async function GET() {
	try {
		const respuesta = await fetch(`${BACKEND_URL}/api/products`, {
			headers: { accept: 'application/json' }
		});

		if (!respuesta.ok) {
			throw new Error(`Backend respondio ${respuesta.status}`);
		}

		const data = await respuesta.json();
		const productos = Array.isArray(data) ? data.map(mapProduct) : [];

		return new Response(JSON.stringify(productos), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('No se pudo consultar backend de productos:', error);

		return new Response(JSON.stringify(productosFallback), {
			headers: { 'content-type': 'application/json' }
		});
	}
}
