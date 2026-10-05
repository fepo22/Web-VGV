import { env } from '$env/dynamic/private';
import { productos as productosFallback } from '$lib/data/productos.js';
import { mapProduct } from '$lib/utils/fetchproductos.js';

const BACKEND_URL = (env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:3000').replace(
	/\/$/,
	''
);

export async function GET() {
	try {
		const respuesta = await fetch(`${BACKEND_URL}/api/products`, {
			headers: { accept: 'application/json' }
		});

		if (!respuesta.ok) {
			throw new Error(`Backend respondio ${respuesta.status}`);
		}

		const data = await respuesta.json();
		const productos = Array.isArray(data)
			? data.map((producto) => mapProduct(producto, { backendBase: BACKEND_URL }))
			: [];

		return new Response(JSON.stringify(productos), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (error) {
		console.error('No se pudo consultar backend de productos:', error);

		return new Response(JSON.stringify(productosFallback.map(mapProduct)), {
			headers: { 'content-type': 'application/json' }
		});
	}
}
