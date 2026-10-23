function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

export async function proxyProductList({ backendUrl, fetcher = fetch, mapProduct }) {
	try {
		const response = await fetcher(`${backendUrl}/api/products`, {
			headers: { accept: 'application/json' }
		});
		if (!response.ok) throw new Error(`Backend respondió ${response.status}`);

		const products = await response.json();
		if (!Array.isArray(products))
			throw new Error('El backend devolvió una lista de productos inválida');
		return jsonResponse(
			products.map((product) => mapProduct(product, { backendBase: backendUrl }))
		);
	} catch (error) {
		console.error('No se pudo consultar backend de productos:', error);
		return jsonResponse({ error: 'No se pudo consultar el catálogo.' }, 502);
	}
}

export async function proxyProductById({ backendUrl, id, fetcher = fetch, mapProduct }) {
	try {
		const response = await fetcher(`${backendUrl}/api/products/${encodeURIComponent(id)}`, {
			headers: { accept: 'application/json' }
		});
		if (response.status === 404) {
			return jsonResponse({ error: 'Producto no encontrado' }, 404);
		}
		if (!response.ok) throw new Error(`Backend respondió ${response.status}`);

		const product = await response.json();
		return jsonResponse(mapProduct(product, { backendBase: backendUrl }));
	} catch (error) {
		console.error('No se pudo consultar detalle de producto en backend:', error);
		return jsonResponse({ error: 'No se pudo consultar el producto.' }, 502);
	}
}
