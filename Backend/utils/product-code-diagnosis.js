// Análisis puro de códigos de producto. Reutiliza la normalización de la aplicación.
import { canonicalProductCode, diagnoseProductCodes } from "./product-code.js";

const CANONICAL_RE = /^[A-Z0-9_-]{1,80}$/;
const typeOf = (value) => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value);

const labelOf = (value) => (typeof value === "string" || value === null ? value : String(JSON.stringify(value)).slice(0, 80));

function scalarEntry(value, inArray) {
	const entry = { label: value ?? null, tipo: value === undefined || value === null ? "ausente/null" : typeOf(value) };
	if (inArray) entry.enArreglo = true;
	if (value === undefined || value === null) return { ...entry, key: "null" };
	if (typeof value === "string") return { ...entry, key: `s:${value}` };
	if (typeof value === "number") return { ...entry, key: `n:${Object.is(value, -0) ? 0 : value}` };
	return { ...entry, key: `${typeof value}:${JSON.stringify(value)}` };
}

// Entradas que un índice único no disperso crearía para un valor de `codigo`.
// Ausente y null son el mismo valor, tipos distintos no coinciden y un arreglo aporta una entrada por elemento (índice multiclave).
// `uncertain` marca lo que no se reproduce con certeza (documentos incrustados o anidados).
function indexEntries(value) {
	if (Array.isArray(value)) {
		if (value.length === 0) return { entries: [{ key: "emptyArray", label: "[]", tipo: "arreglo vacío" }], uncertain: null };
		const entries = [];
		let uncertain = null;
		for (const element of value) {
			if (element !== null && typeof element === "object") uncertain = "elemento anidado (arreglo o documento)";
			entries.push(scalarEntry(element, true));
		}
		return { entries, uncertain };
	}
	const uncertain = value !== null && typeof value === "object" ? "documento incrustado (orden de campos y tipos numéricos)" : null;
	return { entries: [scalarEntry(value, false)], uncertain };
}

// `products`: [{ id, codigo }]. Devuelve solo id y código, nunca otros campos.
export function analyzeProductCodes(products, { sampleLimit = 50 } = {}) {
	const missing = [];
	const empty = [];
	const nonString = [];
	const pattern = [];
	const exactGroups = new Map();
	const sample = (item) => ({ id: item.id, codigo: item.codigo });

	const indexGroups = new Map();
	const uncertainDocs = [];
	const emptyArrayDocs = [];
	let nullKeyDocs = 0;
	for (const product of products) {
		const { codigo } = product;
		const { entries, uncertain } = indexEntries(codigo);
		if (uncertain) uncertainDocs.push({ id: product.id, motivo: uncertain, codigo: labelOf(codigo) });
		if (entries.some((e) => e.key === "emptyArray")) emptyArrayDocs.push(product);
		if (entries.some((e) => e.key === "null")) nullKeyDocs += 1;
		// Un mismo documento puede repetir un elemento sin chocar consigo mismo.
		for (const entry of new Map(entries.map((e) => [e.key, e])).values()) {
			const group = indexGroups.get(entry.key) || { entry, ids: [], inArray: false };
			group.inArray ||= entry.enArreglo === true;
			group.ids.push(product.id);
			indexGroups.set(entry.key, group);
		}
		if (codigo === undefined || codigo === null) { missing.push(sample(product)); continue; }
		if (typeof codigo !== "string") { nonString.push({ id: product.id, tipo: typeOf(codigo), codigo: String(codigo).slice(0, 80) }); continue; }
		if (codigo.trim() === "") { empty.push(sample(product)); continue; }
		if (!CANONICAL_RE.test(codigo)) pattern.push(sample(product));
		const ids = exactGroups.get(codigo) || [];
		ids.push(product.id);
		exactGroups.set(codigo, ids);
	}

	const exactDuplicates = [...exactGroups].filter(([, ids]) => ids.length > 1).map(([codigo, ids]) => ({ codigo, ids }));
	// diagnoseProductCodes aplica canonicalProductCode, la misma función que usan las altas y cambios.
	const stringProducts = products.filter((p) => typeof p.codigo === "string" && p.codigo.trim() !== "");
	const normalizedCollisions = diagnoseProductCodes(stringProducts).collisions
		.filter((c) => new Set(c.products.map((p) => p.codigo)).size > 1)
		.map((c) => ({ canonical: c.canonical, products: c.products }));
	// Códigos que la normalización de la app aceptaría pero que hoy están sin normalizar (bloquean por CODE_HISTORY_REVIEW_REQUIRED).
	const fixableByNormalization = pattern.filter((p) => { try { canonicalProductCode(p.codigo); return true; } catch { return false; } });

	// Grupos que harían fallar createIndex (error 11000) con el índice único no disperso.
	const uniqueIndexConflicts = [...indexGroups.values()].filter((g) => g.ids.length > 1)
		.map((g) => ({ tipo: g.entry.tipo, ...(g.inArray ? { enArreglo: true } : {}), codigo: labelOf(g.entry.label), ids: g.ids }));
	// Un arreglo vacío se indexa como "undefined"; su relación con ausente/null depende de la versión de MongoDB, así que no se asume.
	if (nullKeyDocs > 0) {
		for (const product of emptyArrayDocs) {
			uncertainDocs.push({ id: product.id, motivo: "arreglo vacío frente a documentos sin código o null", codigo: "[]" });
		}
	}

	const cut = (list) => list.slice(0, sampleLimit);
	const counts = {
		total: products.length,
		missing: missing.length,
		empty: empty.length,
		nonString: nonString.length,
		patternViolations: pattern.length,
		normalizableViolations: fixableByNormalization.length,
		exactDuplicateGroups: exactDuplicates.length,
		normalizedCollisionGroups: normalizedCollisions.length,
		uniqueIndexConflictGroups: uniqueIndexConflicts.length,
		uniqueIndexUncertain: uncertainDocs.length
	};
	// "seguro" solo si no hay conflictos y todo se pudo evaluar con certeza.
	const uniqueIndexVerdict = counts.uniqueIndexConflictGroups > 0 ? "conflicto" : counts.uniqueIndexUncertain > 0 ? "indeterminado" : "seguro";
	return {
		counts,
		blocksCodeWrites: counts.missing + counts.empty + counts.nonString + counts.patternViolations > 0,
		uniqueIndexVerdict,
		blocksUniqueIndex: uniqueIndexVerdict !== "seguro",
		samples: {
			uniqueIndexConflicts: cut(uniqueIndexConflicts),
			uniqueIndexUncertain: cut(uncertainDocs),
			missing: cut(missing), empty: cut(empty), nonString: cut(nonString), pattern: cut(pattern),
			exactDuplicates: cut(exactDuplicates), normalizedCollisions: cut(normalizedCollisions)
		}
	};
}
