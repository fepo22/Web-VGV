import { env } from '$env/dynamic/private';
import { mapProduct } from '$lib/utils/fetchproductos.js';
import { proxyProductList } from '$lib/utils/products-proxy.js';

const BACKEND_URL = (env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:3000').replace(
	/\/$/,
	''
);

export async function GET() {
	return proxyProductList({ backendUrl: BACKEND_URL, mapProduct });
}
