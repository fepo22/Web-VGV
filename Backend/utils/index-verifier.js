// Comparación pura entre índices requeridos y presentes. No toca la base de datos.

const SAME_KEY = (a, b) => JSON.stringify(Object.entries(a || {})) === JSON.stringify(Object.entries(b || {}));

export function defaultIndexName(key) {
	return Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_");
}

// Convierte `schema.indexes()` de Mongoose en especificaciones comparables.
export function specsFromSchema(schema, extra = []) {
	const fromSchema = schema.indexes().map(([key, options = {}]) => ({
		name: options.name || defaultIndexName(key),
		key,
		unique: options.unique === true,
		sparse: options.sparse === true,
		collation: options.collation || null
	}));
	const idSpec = { name: "_id_", key: { _id: 1 }, unique: false, sparse: false, collation: null };
	return [idSpec, ...fromSchema, ...extra.map((spec) => ({ unique: false, sparse: false, collation: null, ...spec }))];
}

function describeDifferences(expected, present) {
	const diffs = [];
	if (!SAME_KEY(expected.key, present.key)) diffs.push("clave distinta");
	if ((present.unique === true) !== expected.unique) diffs.push(`unique esperado=${expected.unique}`);
	if ((present.sparse === true) !== expected.sparse) diffs.push(`sparse esperado=${expected.sparse}`);
	if (Boolean(present.collation) !== Boolean(expected.collation)) diffs.push("collation distinta");
	else if (expected.collation && present.collation) {
		for (const [field, value] of Object.entries(expected.collation)) {
			if (present.collation[field] !== value) diffs.push(`collation.${field} esperado=${value}`);
		}
	}
	return diffs;
}

// Devuelve discrepancias por colección. `presentByCollection[name] === null` = la colección no existe.
export function compareIndexes(expectedByCollection, presentByCollection) {
	const report = [];
	for (const [collection, expectedSpecs] of Object.entries(expectedByCollection)) {
		const present = presentByCollection[collection];
		if (present === null || present === undefined) {
			report.push({ collection, type: "missing_collection", detail: "La colección no existe" });
			continue;
		}
		for (const expected of expectedSpecs) {
			const match = present.find((index) => index.name === expected.name)
				|| present.find((index) => SAME_KEY(index.key, expected.key));
			if (!match) {
				report.push({ collection, type: "missing_index", name: expected.name, key: expected.key });
				continue;
			}
			const diffs = describeDifferences(expected, match);
			if (diffs.length) report.push({ collection, type: "mismatch", name: expected.name, detail: diffs.join("; ") });
		}
		const knownNames = new Set(expectedSpecs.map((spec) => spec.name));
		const knownKeys = expectedSpecs.map((spec) => spec.key);
		for (const index of present) {
			if (!knownNames.has(index.name) && !knownKeys.some((key) => SAME_KEY(key, index.key))) {
				report.push({ collection, type: "unexpected_index", name: index.name, key: index.key });
			}
		}
	}
	return report;
}
