export class ProductWriteError extends Error {
	constructor(message, status, code) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export function canonicalProductCode(value) {
	if (typeof value !== "string" && typeof value !== "number") {
		throw new ProductWriteError("El codigo es obligatorio.", 400, "INVALID_CODE");
	}
	const code = String(value).trim().toUpperCase().replace(/\s+/g, "-");
	if (!/^[A-Z0-9_-]{1,80}$/.test(code)) {
		throw new ProductWriteError("El codigo admite letras ASCII, números, guiones y guiones bajos; no se descartan caracteres.", 400, "INVALID_CODE");
	}
	return code;
}

export const CODE_INDEX_NAME = "e0_codigo_unique";

export function diagnoseProductCodes(products) {
	const groups = new Map();
	const invalid = [];
	const noncanonical = [];
	for (const product of products) {
		try {
			const canonical = canonicalProductCode(product.codigo);
			if (canonical !== product.codigo) noncanonical.push({ id: product.id, codigo: product.codigo, canonical });
			const matches = groups.get(canonical) || [];
			matches.push({ id: product.id, codigo: product.codigo });
			groups.set(canonical, matches);
		} catch {
			invalid.push({ id: product.id, codigo: product.codigo });
		}
	}
	return { invalid, noncanonical, collisions: [...groups].filter(([, matches]) => matches.length > 1)
		.map(([canonical, products]) => ({ canonical, products })) };
}

// Única definición del índice aprobado; la usan la guardia de escritura y los verificadores.
export function isApprovedCodeIndex(index) {
	return index.name === CODE_INDEX_NAME && index.unique === true &&
		Object.keys(index.key).length === 1 && index.key.codigo === 1 &&
		!index.sparse && !index.partialFilterExpression &&
		(!index.collation || index.collation.locale === "simple");
}

export async function requireCodeIndex(model) {
	let indexes;
	try {
		indexes = await model.collection.indexes();
	} catch (error) {
		if (error.code !== 26) throw error;
		indexes = [];
	}
	if (!indexes.some(isApprovedCodeIndex)) {
		throw new ProductWriteError("Altas y cambios de código bloqueados: falta el índice único aprobado.", 503, "CODE_INDEX_REQUIRED");
	}
	// PCRE absolute anchors reject trailing newlines; $ can match before one.
	if (await model.collection.findOne({ $or: [
		{ codigo: { $not: { $regex: "\\A[A-Z0-9_-]{1,80}\\z" } } },
		{ $expr: { $ne: [{ $type: "$codigo" }, "string"] } }
	] }, { projection: { _id: 1 } })) {
		throw new ProductWriteError("Altas y cambios de código bloqueados: existen códigos históricos no canónicos pendientes de revisión.", 503, "CODE_HISTORY_REVIEW_REQUIRED");
	}
}

export function duplicateCodeError(error) {
	if (error?.code === 11000 && (error.keyPattern?.codigo || error.message?.includes(CODE_INDEX_NAME))) {
		return new ProductWriteError("El código ya existe; no se sobrescribió el producto existente.", 409, "DUPLICATE_CODE");
	}
	return error;
}
