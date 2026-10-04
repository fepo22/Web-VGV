export const MAX_BATCH_FILES = 30;
export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
export const MAX_COMPRESSED_BYTES = 1024 * 1024;
export const MAX_DIMENSION = 1600;

// Solo quitar la última extensión: no aproximar, quitar acentos ni cambiar separadores.
export function filenameKey(filename) {
	return String(filename)
		.replace(/\.[^.]+$/, '')
		.toLowerCase();
}

export function matchImageProducts(filename, products) {
	const key = filenameKey(filename);
	if (!key) return [];
	return products.filter((product) =>
		[product.codigo, product.id, ...(product.variantes || []).map((variant) => variant.sku)].some(
			(value) => value != null && String(value).toLowerCase() === key
		)
	);
}

export function validateOriginalImage(file) {
	if (!file.size || file.size > MAX_ORIGINAL_BYTES) {
		throw new Error('El original debe pesar entre 1 byte y 10 MiB.');
	}
	if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
		throw new Error('Solo JPEG, PNG y WebP estáticos; no SVG.');
	}
}

export function duplicateProductIds(rows) {
	const seen = new Set();
	const duplicates = new Set();
	for (const row of rows) {
		if (!row.productId) continue;
		if (seen.has(row.productId)) duplicates.add(row.productId);
		seen.add(row.productId);
	}
	return duplicates;
}
