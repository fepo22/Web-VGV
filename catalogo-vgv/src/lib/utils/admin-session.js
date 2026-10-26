export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Vuelve a iniciar sesión.';
export const SESSION_FORBIDDEN_MESSAGE =
	'Tu sesión no tiene acceso de administrador. Vuelve a iniciar sesión.';

const FLASH_KEY = 'vgv_admin_flash';

export function setSessionFlash(message, storage = globalThis.sessionStorage) {
	try {
		if (message) storage.setItem(FLASH_KEY, message);
	} catch {
		// Sin almacenamiento disponible: el aviso se omite.
	}
}

export function takeSessionFlash(storage = globalThis.sessionStorage) {
	try {
		const message = storage.getItem(FLASH_KEY) || '';
		storage.removeItem(FLASH_KEY);
		return message;
	} catch {
		return '';
	}
}

export function isAuthFailure(status) {
	return status === 401 || status === 403;
}

// 401 = token ausente, inválido o vencido; 403 = token válido sin rol de administrador.
export function sessionFailureMessage(status) {
	if (status === 401) return SESSION_EXPIRED_MESSAGE;
	if (status === 403) return SESSION_FORBIDDEN_MESSAGE;
	return null;
}

// Decodifica el payload sin verificar la firma: solo sirve para anticipar el vencimiento en la UI.
function decodePayload(token) {
	try {
		const parts = String(token).split('.');
		if (parts.length !== 3 || !parts[1]) return null;
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
		return payload && typeof payload === 'object' ? payload : null;
	} catch {
		return null;
	}
}

export function tokenExpiresAtMs(token) {
	const exp = decodePayload(token)?.exp;
	return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
}

// Token ausente o ilegible = vencido; sin `exp` se deja que el servidor decida.
export function isTokenExpired(token, now = Date.now()) {
	if (!token || !decodePayload(token)) return true;
	const expiresAt = tokenExpiresAtMs(token);
	return expiresAt !== null && expiresAt <= now;
}
