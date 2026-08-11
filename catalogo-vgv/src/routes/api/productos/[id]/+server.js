import { env } from '$env/dynamic/private';
import { productos as productosFallback } from '$lib/data/productos.js';

const BACKEND_URL = (env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:4000').replace(
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

export async function GET({ params }) {
	const id = String(params.id);

	try {
		const respuesta = await fetch(`${BACKEND_URL}/api/productos/${id}`, {
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
