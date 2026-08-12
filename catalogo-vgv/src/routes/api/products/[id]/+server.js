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
		precioDescuento: Number.isFinite(Number(producto.precioDescuento))
			? Number(producto.precioDescuento)
			: null,
		descripcion: producto.descripcion || '',
		imagen: producto.imagen || '/images/placeholder.png',
		categoria: producto.categoria || producto.categoriaSlug || 'Sin categoria',
		categoriaSlug: producto.categoriaSlug || producto.categoria || 'sin-categoria',
		stock: Math.max(0, Number(producto.stock ?? 0)),
		estado: String(
			producto.estado || (Number(producto.stock ?? 0) > 0 ? 'disponible' : 'sin stock')
		),
		oferta:
			Boolean(producto.oferta) ||
			(Number.isFinite(Number(producto.precioDescuento)) &&
				Number(producto.precioDescuento) > 0 &&
				Number(producto.precioDescuento) < Number(producto.precio ?? 0)),
		descuentoPct: Number.isFinite(Number(producto.descuentoPct))
			? Number(producto.descuentoPct)
			: null,
		variantes
	};
}

export async function GET({ params }) {
	const id = String(params.id);

	try {
		const respuesta = await fetch(`${BACKEND_URL}/api/products/${id}`, {
			headers: { accept: 'application/json' }
		});

		if (!respuesta.ok) {
			return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
				status: 404,
				headers: { 'content-type': 'application/json' }
			});
		}

		const data = await respuesta.json();

		return new Response(JSON.stringify(mapProduct(data)), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('No se pudo consultar detalle de producto en backend:', error);
		const producto = productosFallback.find((item) => item.id === id) ?? null;

		if (!producto) {
			return new Response(JSON.stringify({ error: 'Producto no encontrado' }), {
				status: 404,
				headers: { 'content-type': 'application/json' }
			});
		}

		return new Response(JSON.stringify(producto), {
			headers: { 'content-type': 'application/json' }
		});
	}
}
