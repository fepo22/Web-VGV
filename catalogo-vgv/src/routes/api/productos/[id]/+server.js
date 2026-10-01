import { env } from '$env/dynamic/private';
import { productos as productosFallback } from '$lib/data/productos.js';
import { mapProduct } from '$lib/utils/fetchproductos.js';

const BACKEND_URL = (env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:3000').replace(
	/\/$/,
	''
);

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

		return new Response(JSON.stringify(mapProduct(producto)), {
			headers: { 'content-type': 'application/json' }
		});
	}
}
