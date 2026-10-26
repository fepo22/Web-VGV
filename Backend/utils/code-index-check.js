// Diagnóstico puro (sin acceso a BD) del índice de códigos frente a lo que exige requireCodeIndex.
import { CODE_INDEX_NAME, isApprovedCodeIndex } from "./product-code.js";

const isSimpleCollation = (collation) => !collation || collation.locale === "simple";

// `indexes === null` significa que la colección no existe.
export function checkCodeIndex(indexes) {
	if (indexes === null || indexes === undefined) {
		return { collectionExists: false, indexFound: false, approved: false, checks: [], candidates: [] };
	}
	const byName = indexes.find((index) => index.name === CODE_INDEX_NAME);
	const keyedOnCode = indexes.filter((index) => index.key?.codigo !== undefined && index.name !== CODE_INDEX_NAME)
		.map((index) => ({ name: index.name, key: index.key, unique: index.unique === true }));
	const checks = byName
		? [
			["nombre exacto", true],
			["clave única { codigo: 1 }", Object.keys(byName.key).length === 1 && byName.key.codigo === 1],
			["unique = true", byName.unique === true],
			["sin sparse", !byName.sparse],
			["sin partialFilterExpression", !byName.partialFilterExpression],
			["colación ausente o simple", isSimpleCollation(byName.collation)]
		].map(([check, ok]) => ({ check, ok }))
		: [{ check: "nombre exacto", ok: false }];
	return {
		collectionExists: true,
		indexFound: Boolean(byName),
		approved: indexes.some(isApprovedCodeIndex),
		checks,
		candidates: keyedOnCode
	};
}
