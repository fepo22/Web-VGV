import { env } from '$env/dynamic/private';
import { productos as productosFallback } from '$lib/data/productos.js';

const BACKEND_URL = (env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:4000').replace(
	/\/$/,
	''
);

function mapProduct(producto) {
	return {
		id: String(producto.id),
		nombre: producto.nombre,
		precio: Number(producto.precio ?? 0),
		descripcion: producto.descripcion || '',
		imagen: producto.imagen || '/images/placeholder.png',
		categoria: producto.categoria || producto.categoriaSlug || 'Sin categoria',
		categoriaSlug: producto.categoriaSlug || producto.categoria || 'sin-categoria'
	};
}

export async function GET() {
	try {
		const respuesta = await fetch(`${BACKEND_URL}/api/productos`, {
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
