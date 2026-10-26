import { loadProductDetail } from '$lib/utils/product-detail.js';

export async function load({ params, fetch }) {
	return loadProductDetail(fetch, params.id);
}
