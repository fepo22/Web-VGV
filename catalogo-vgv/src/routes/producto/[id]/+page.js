import { backendUrl } from '$lib/utils/backend-url.js';

export async function load({ params, fetch }) {
	try {
		const respuesta = await fetch(backendUrl(`/api/products/${params.id}`));
		if (!respuesta.ok) {
			return { producto: null };
		}

		const producto = await respuesta.json();
		return { producto };
	} catch (error) {
		console.error('Error cargando detalle de producto:', error);
		return { producto: null };
	}
}
