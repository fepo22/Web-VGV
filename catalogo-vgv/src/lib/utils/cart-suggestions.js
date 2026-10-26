const sameId = (a, b) => String(a) === String(b);

// Sugerencias del carrito calculadas solo con productos reales del catálogo.
export function selectCartSuggestions({ catalogo, items, viewedIds }) {
	const products = Array.isArray(catalogo) ? catalogo : [];
	if (!products.length || !items?.length) return { vistos: [], complementarios: [] };
	const inCart = (producto) => items.some((item) => sameId(item.id, producto.id));
	const categories = new Set(items.map((item) => item.categoriaSlug || item.categoria));
	const vistos = (Array.isArray(viewedIds) ? viewedIds : [])
		.map((id) => products.find((producto) => sameId(producto.id, id)))
		.filter(Boolean)
		.filter((producto) => !inCart(producto))
		.slice(0, 2);
	const complementarios = products
		.filter((producto) => !inCart(producto))
		.filter((producto) => !vistos.some((visto) => sameId(visto.id, producto.id)))
		.filter((producto) => categories.has(producto.categoriaSlug || producto.categoria))
		.slice(0, 3);
	return { vistos, complementarios };
}
