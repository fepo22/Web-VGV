export function variantChoices(variants) {
	const counts = new Map();
	for (const variant of variants) {
		const sku = typeof variant.sku === 'string' ? variant.sku : '';
		counts.set(sku.trim(), (counts.get(sku.trim()) || 0) + 1);
	}
	return variants.map((variant) => {
		const sku = typeof variant.sku === 'string' ? variant.sku : '';
		const issue =
			!sku.trim() || sku !== sku.trim()
				? 'Esta medida no tiene un SKU válido. Contacta a VGV para identificarla.'
				: counts.get(sku.trim()) !== 1
					? 'Este SKU está duplicado. Contacta a VGV antes de seleccionar la medida.'
					: '';
		return { variant, selectable: !issue, issue };
	});
}

export function cartItemIdentityError(item) {
	if (item.id == null || !String(item.id).trim()) {
		return 'El producto no tiene una identidad válida. Revisa la ficha antes de cotizar.';
	}
	if (
		(item.varianteMedida || item.varianteSku != null) &&
		(typeof item.varianteSku !== 'string' ||
			!item.varianteSku.trim() ||
			item.varianteSku !== item.varianteSku.trim())
	) {
		return 'La medida no tiene un SKU válido. Retírala y consulta su identificación con VGV.';
	}
	if (Array.isArray(item.variantes) && item.variantes.length) {
		const choices = variantChoices(item.variantes);
		if (
			!choices.some(({ variant, selectable }) => selectable && variant.sku === item.varianteSku)
		) {
			return 'Selecciona una medida con SKU único desde la ficha del producto.';
		}
	}
	return '';
}

export function cartIdentityError(items) {
	const seen = new Set();
	for (const item of items) {
		const issue = cartItemIdentityError(item);
		if (issue) return issue;
		const identity = cartIdentity(item);
		if (seen.has(identity))
			return 'Hay líneas con la misma identidad en el carrito. Revísalas antes de cotizar.';
		seen.add(identity);
	}
	return '';
}

export function cartIdentity(item) {
	const issue = cartItemIdentityError(item);
	if (issue) throw new Error(issue);
	// JSON tuple keys cannot collide when product IDs or SKUs contain separators.
	return JSON.stringify([String(item.id), item.varianteSku || null]);
}
