import { redirect } from '@sveltejs/kit';

// Flujo desactivado temporalmente para todo visitante. Quitar este redirect
// y volver a habilitar los enlaces de menú para reactivar la página conservada.
export function load() {
	redirect(307, '/');
}
