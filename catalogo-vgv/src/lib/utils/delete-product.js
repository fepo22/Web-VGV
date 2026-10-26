export function buildDeleteBody(product) {
	return JSON.stringify({ _expectedUpdatedAt: product?.updatedAt ?? null });
}

// kind: deleted | conflict | missing | error
export function interpretDeleteResponse(status, data = {}) {
	if (status === 409 || status === 428) {
		return {
			kind: 'conflict',
			message:
				status === 409
					? `${data?.error || 'El producto cambió desde que lo cargaste.'} No se eliminó; la lista se actualizó, revisa el producto y vuelve a intentarlo.`
					: 'El servidor requiere una versión actual. No se eliminó; la lista se actualizó, vuelve a intentarlo.'
		};
	}
	if (status === 404) {
		return { kind: 'missing', message: 'El producto ya no existe. La lista se actualizó.' };
	}
	if (status >= 200 && status < 300) {
		return {
			kind: 'deleted',
			message:
				data?.referencesCleanup === 'pending'
					? 'Producto eliminado, pero quedó pendiente limpiar sus referencias en productos relacionados. Se completa repitiendo la eliminación del mismo id o con el verificador de referencias; el catálogo público ya omite referencias inexistentes.'
					: 'Producto eliminado correctamente.'
		};
	}
	return { kind: 'error', message: data?.error || 'No se pudo eliminar el producto.' };
}
