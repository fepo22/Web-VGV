export const MAX_RELATED_PRODUCTS = 20;

export function normalizeRelatedProductIds(value, currentId) {
	if (!Array.isArray(value) || value.length > MAX_RELATED_PRODUCTS) {
		throw new Error(`Selecciona hasta ${MAX_RELATED_PRODUCTS} productos relacionados.`);
	}
	const ids = value.map((id) => {
		if (typeof id !== "string" || !id.trim() || id.length > 200) {
			throw new Error("Los IDs relacionados deben ser textos válidos.");
		}
		return id.trim();
	});
	if (currentId != null && ids.includes(String(currentId))) {
		throw new Error("Un producto no puede relacionarse consigo mismo.");
	}
	return [...new Set(ids)];
}

export async function validateRelatedProductIds(value, currentId, findProducts) {
	const ids = normalizeRelatedProductIds(value, currentId);
	if (!ids.length) return ids;
	const products = await findProducts(ids);
	const existing = new Set(products.map((product) => String(product.id)));
	if (ids.some((id) => !existing.has(id))) {
		throw new Error("Algún producto relacionado ya no existe. Actualiza la lista y vuelve a seleccionar.");
	}
	return ids;
}