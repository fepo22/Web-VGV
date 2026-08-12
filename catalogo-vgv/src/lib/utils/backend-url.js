import { browser } from '$app/environment';

function trimTrailingSlash(url) {
	return String(url || '').replace(/\/$/, '');
}

export function getBackendUrl() {
	const configured = trimTrailingSlash(import.meta.env.VITE_BACKEND_URL || '');
	if (configured) return configured;

	if (browser) {
		const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
		if (isLocal) return 'http://localhost:3000';
		return trimTrailingSlash(window.location.origin);
	}

	return 'http://localhost:3000';
}

export function backendUrl(path = '') {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `${getBackendUrl()}${normalizedPath}`;
}
