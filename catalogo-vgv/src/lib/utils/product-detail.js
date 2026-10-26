const DETAIL_ERROR = 'No se pudo cargar el producto. Revisa tu conexión e inténtalo nuevamente.';

// notFound = el backend confirmó 404; loadError = fallo de servidor o de red (no implica que no exista).
export async function loadProductDetail(fetcher, id) {
	try {
		const respuesta = await fetcher(`/api/products/${encodeURIComponent(id)}`);
		if (respuesta.status === 404) return { producto: null, notFound: true, loadError: '' };
		if (!respuesta.ok) return { producto: null, notFound: false, loadError: DETAIL_ERROR };
		const producto = await respuesta.json();
		if (!producto || typeof producto !== 'object' || !producto.id) {
			return { producto: null, notFound: false, loadError: DETAIL_ERROR };
		}
		return { producto, notFound: false, loadError: '' };
	} catch (error) {
		console.error('Error cargando detalle de producto:', error);
		return { producto: null, notFound: false, loadError: DETAIL_ERROR };
	}
}
