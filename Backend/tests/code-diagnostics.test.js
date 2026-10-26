import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProductCodes } from "../utils/product-code-diagnosis.js";
import { checkCodeIndex } from "../utils/code-index-check.js";
import { compareIndexes, specsFromSchema } from "../utils/index-verifier.js";
import { isApprovedCodeIndex, requireCodeIndex, canonicalProductCode } from "../utils/product-code.js";
import mongoose from "mongoose";

const good = { name: "e0_codigo_unique", key: { codigo: 1 }, unique: true };

test("diagnóstico de códigos: clasifica tipos, patrón, vacíos y ausentes", () => {
	const r = analyzeProductCodes([
		{ id: "1", codigo: "OK-1" },
		{ id: "2", codigo: 123 },
		{ id: "3", codigo: ["A"] },
		{ id: "4", codigo: "" },
		{ id: "5", codigo: "   " },
		{ id: "6" },
		{ id: "7", codigo: null },
		{ id: "8", codigo: "ok 2" },
		{ id: "9", codigo: "A".repeat(81) },
		{ id: "10", codigo: "CON\n" },
		{ id: "11", codigo: "Ñandú" }
	]);
	assert.equal(r.counts.total, 11);
	assert.equal(r.counts.nonString, 2);
	assert.equal(r.counts.empty, 2);
	assert.equal(r.counts.missing, 2);
	assert.equal(r.counts.patternViolations, 4);
	assert.equal(r.counts.normalizableViolations, 2);
	assert.equal(r.blocksCodeWrites, true);
});

test("diagnóstico de códigos: duplicados exactos y colisiones normalizadas son distintos", () => {
	const r = analyzeProductCodes([
		{ id: "1", codigo: "DUP-1" }, { id: "2", codigo: "DUP-1" },
		{ id: "3", codigo: "a-1" }, { id: "4", codigo: "A-1" }, { id: "5", codigo: " a 1 " }, { id: "6", codigo: "A-1" }
	]);
	assert.deepEqual(r.samples.exactDuplicates.map((d) => [d.codigo, d.ids]).sort(), [["A-1", ["4", "6"]], ["DUP-1", ["1", "2"]]]);
	assert.equal(r.blocksUniqueIndex, true);
	assert.deepEqual(r.samples.normalizedCollisions.map((c) => c.canonical), ["A-1"]);
	assert.equal(r.samples.normalizedCollisions[0].products.length, 4);
});

const blocks = (rows) => analyzeProductCodes(rows).blocksUniqueIndex;
const conflicts = (rows) => analyzeProductCodes(rows).samples.uniqueIndexConflicts;

test("blocksUniqueIndex: dos documentos sin campo codigo chocan", () => {
	assert.equal(blocks([{ id: "1" }, { id: "2" }]), true);
	assert.deepEqual(conflicts([{ id: "1" }, { id: "2" }]), [{ tipo: "ausente/null", codigo: null, ids: ["1", "2"] }]);
});

test("blocksUniqueIndex: dos documentos con codigo null chocan", () => {
	assert.equal(blocks([{ id: "1", codigo: null }, { id: "2", codigo: null }]), true);
});

test("blocksUniqueIndex: ausente y null son el mismo valor para MongoDB", () => {
	assert.equal(blocks([{ id: "1" }, { id: "2", codigo: null }]), true);
});

test("blocksUniqueIndex: un solo documento sin código no es duplicado", () => {
	const rows = [{ id: "1" }, { id: "2", codigo: "A-1" }];
	assert.equal(blocks(rows), false);
	assert.equal(analyzeProductCodes(rows).counts.uniqueIndexConflictGroups, 0);
	assert.equal(analyzeProductCodes(rows).blocksCodeWrites, true);
});

test("blocksUniqueIndex: vacíos repetidos chocan, uno solo no", () => {
	assert.equal(blocks([{ id: "1", codigo: "" }, { id: "2", codigo: "" }]), true);
	assert.equal(blocks([{ id: "1", codigo: "" }, { id: "2", codigo: "A" }]), false);
});

test("blocksUniqueIndex: valores no textuales repetidos chocan; tipos distintos no", () => {
	assert.equal(blocks([{ id: "1", codigo: 5 }, { id: "2", codigo: 5 }]), true);
	assert.equal(blocks([{ id: "1", codigo: 5 }, { id: "2", codigo: "5" }]), false);
	assert.equal(blocks([{ id: "1", codigo: true }, { id: "2", codigo: true }]), true);
	assert.equal(blocks([{ id: "1", codigo: 0 }, { id: "2", codigo: -0 }]), true);
});

test("blocksUniqueIndex: duplicados exactos de texto chocan; solo diferir en mayúsculas no (colación simple)", () => {
	assert.equal(blocks([{ id: "1", codigo: "A-1" }, { id: "2", codigo: "A-1" }]), true);
	assert.equal(blocks([{ id: "1", codigo: "A-1" }, { id: "2", codigo: "a-1" }]), false);
});

test("blocksUniqueIndex y blocksCodeWrites son independientes", () => {
	const onlyIndex = analyzeProductCodes([{ id: "1", codigo: "A-1" }, { id: "2", codigo: "A-1" }]);
	assert.equal(onlyIndex.blocksUniqueIndex, true);
	assert.equal(onlyIndex.blocksCodeWrites, false);
	const onlyWrites = analyzeProductCodes([{ id: "1", codigo: "a-1" }]);
	assert.equal(onlyWrites.blocksUniqueIndex, false);
	assert.equal(onlyWrites.blocksCodeWrites, true);
});

test("colisión normalizada distinta de duplicado exacto y sin impedir el índice por sí sola", () => {
	const r = analyzeProductCodes([{ id: "1", codigo: "a-1" }, { id: "2", codigo: "A-1" }]);
	assert.equal(r.counts.normalizedCollisionGroups, 1);
	assert.equal(r.counts.exactDuplicateGroups, 0);
	assert.equal(r.blocksUniqueIndex, false);
});

test("diagnóstico: el resultado no depende del orden de los documentos", () => {
	const rows = [
		{ id: "1" }, { id: "2", codigo: null }, { id: "3", codigo: 5 }, { id: "4", codigo: 5 }, { id: "5", codigo: "" },
		{ id: "6", codigo: "" }, { id: "7", codigo: "A-1" }, { id: "8", codigo: "A-1" }, { id: "9", codigo: "a 1" }, { id: "10", codigo: "ok" }
	];
	const norm = (r) => JSON.stringify({ c: r.counts, b: [r.blocksCodeWrites, r.blocksUniqueIndex],
		u: r.samples.uniqueIndexConflicts.map((g) => [g.tipo, g.codigo, [...g.ids].sort()]).sort(),
		n: r.samples.normalizedCollisions.map((g) => g.canonical).sort() });
	const base = norm(analyzeProductCodes(rows));
	assert.equal(norm(analyzeProductCodes([...rows].reverse())), base);
	assert.equal(norm(analyzeProductCodes([...rows.slice(5), ...rows.slice(0, 5)])), base);
});

test("arreglos: ['A'] frente a 'A' chocan (índice multiclave); un solo arreglo no", () => {
	assert.equal(blocks([{ id: "1", codigo: ["A"] }, { id: "2", codigo: "A" }]), true);
	assert.deepEqual(conflicts([{ id: "1", codigo: ["A"] }, { id: "2", codigo: "A" }]), [{ tipo: "string", enArreglo: true, codigo: "A", ids: ["1", "2"] }]);
	const alone = analyzeProductCodes([{ id: "1", codigo: ["A"] }, { id: "2", codigo: "B" }]);
	assert.equal(alone.uniqueIndexVerdict, "seguro");
	assert.equal(alone.blocksCodeWrites, true);
});

test("arreglos: dos arreglos que comparten un elemento chocan", () => {
	const rows = [{ id: "1", codigo: ["A", "B"] }, { id: "2", codigo: ["C", "B"] }];
	assert.deepEqual(conflicts(rows), [{ tipo: "string", enArreglo: true, codigo: "B", ids: ["1", "2"] }]);
	assert.equal(blocks(rows), true);
	assert.equal(blocks([{ id: "1", codigo: ["A", "B"] }, { id: "2", codigo: ["C", "D"] }]), false);
});

test("arreglos: elementos repetidos dentro del mismo documento no chocan consigo mismo", () => {
	assert.equal(analyzeProductCodes([{ id: "1", codigo: ["A", "A"] }]).uniqueIndexVerdict, "seguro");
	assert.equal(blocks([{ id: "1", codigo: ["A", "A"] }, { id: "2", codigo: "Z" }]), false);
});

test("arreglos vacíos: dos chocan; con un documento ausente/null el resultado es indeterminado, no seguro", () => {
	assert.equal(analyzeProductCodes([{ id: "1", codigo: [] }, { id: "2", codigo: [] }]).uniqueIndexVerdict, "conflicto");
	const r = analyzeProductCodes([{ id: "1", codigo: [] }, { id: "2" }]);
	assert.equal(r.uniqueIndexVerdict, "indeterminado");
	assert.equal(r.blocksUniqueIndex, true);
	assert.equal(r.samples.uniqueIndexUncertain[0].id, "1");
	assert.equal(analyzeProductCodes([{ id: "1", codigo: [] }, { id: "2", codigo: "A" }]).uniqueIndexVerdict, "seguro");
});

test("arreglo con null o ausente: null dentro de un arreglo choca con documento sin código", () => {
	assert.equal(analyzeProductCodes([{ id: "1", codigo: [null] }, { id: "2" }]).uniqueIndexVerdict, "conflicto");
});

test("elementos anidados y documentos incrustados son indeterminados, nunca seguros", () => {
	for (const codigo of [[["A"]], [{ a: 1 }], { a: 1 }]) {
		const r = analyzeProductCodes([{ id: "1", codigo }, { id: "2", codigo: "Z" }]);
		assert.equal(r.uniqueIndexVerdict, "indeterminado");
		assert.equal(r.blocksUniqueIndex, true);
		assert.equal(r.counts.uniqueIndexUncertain, 1);
	}
});

test("arreglos: el resultado no depende del orden", () => {
	const rows = [{ id: "1", codigo: ["A", "B"] }, { id: "2", codigo: "B" }, { id: "3", codigo: [] }, { id: "4", codigo: [] }, { id: "5", codigo: [["x"]] }];
	const norm = (r) => JSON.stringify({ v: r.uniqueIndexVerdict, c: r.counts,
		u: r.samples.uniqueIndexConflicts.map((g) => [g.tipo, g.codigo, [...g.ids].sort()]).sort(),
		x: r.samples.uniqueIndexUncertain.map((g) => g.id).sort() });
	assert.equal(norm(analyzeProductCodes([...rows].reverse())), norm(analyzeProductCodes(rows)));
});

test("diagnóstico de códigos: datos limpios no tienen hallazgos y la salida solo lleva id y código", () => {
	const r = analyzeProductCodes([{ id: "1", codigo: "A-1", nombre: "secreto", precioCosto: 5 }, { id: "2", codigo: "B_2" }]);
	assert.equal(r.blocksCodeWrites, false);
	assert.equal(r.blocksUniqueIndex, false);
	assert.equal(r.counts.normalizedCollisionGroups, 0);
	assert.equal(JSON.stringify(r).includes("secreto"), false);
});

test("diagnóstico usa la misma normalización que la aplicación", () => {
	const r = analyzeProductCodes([{ id: "1", codigo: " x y " }, { id: "2", codigo: "X-Y" }]);
	assert.equal(canonicalProductCode(" x y "), "X-Y");
	assert.equal(r.counts.normalizedCollisionGroups, 1);
});

test("diagnóstico: muestras limitadas", () => {
	const many = Array.from({ length: 120 }, (_, i) => ({ id: String(i), codigo: `bad ${i}!` }));
	const r = analyzeProductCodes(many, { sampleLimit: 10 });
	assert.equal(r.counts.patternViolations, 120);
	assert.equal(r.samples.pattern.length, 10);
});

test("checkCodeIndex: cada propiedad exigida se comprueba", () => {
	assert.equal(checkCodeIndex(null).collectionExists, false);
	assert.equal(checkCodeIndex([{ name: "_id_", key: { _id: 1 } }]).indexFound, false);
	assert.equal(checkCodeIndex([good]).approved, true);
	assert.equal(checkCodeIndex([{ ...good, collation: { locale: "simple" } }]).approved, true);
	const bad = {
		unique: { ...good, unique: false },
		sparse: { ...good, sparse: true },
		partial: { ...good, partialFilterExpression: { codigo: { $exists: true } } },
		collation: { ...good, collation: { locale: "es", strength: 2 } },
		compound: { ...good, key: { codigo: 1, id: 1 } },
		descending: { ...good, key: { codigo: -1 } },
		field: { ...good, key: { sku: 1 } }
	};
	for (const [label, index] of Object.entries(bad)) {
		const r = checkCodeIndex([index]);
		assert.equal(r.approved, false, label);
		assert.equal(r.checks.some((c) => !c.ok), true, label);
		assert.equal(isApprovedCodeIndex(index), false, label);
	}
	const named = checkCodeIndex([{ name: "codigo_1", key: { codigo: 1 } }]);
	assert.equal(named.indexFound, false);
	assert.equal(named.candidates[0].name, "codigo_1");
});

test("checkCodeIndex coincide con requireCodeIndex en los casos probados", async () => {
	for (const index of [good, { ...good, sparse: true }, { ...good, name: "otro" }, { ...good, collation: { locale: "en" } }]) {
		const model = { collection: { indexes: async () => [index], findOne: async () => null } };
		let allowed = true;
		try { await requireCodeIndex(model); } catch { allowed = false; }
		assert.equal(checkCodeIndex([index]).approved, allowed);
	}
});

test("index-verifier: nombre, partialFilterExpression y colación simple", () => {
	const schema = new mongoose.Schema({ codigo: String });
	const expected = { products: specsFromSchema(schema, [{ name: "e0_codigo_unique", key: { codigo: 1 }, unique: true }]) };
	const base = [{ name: "_id_", key: { _id: 1 } }];
	assert.deepEqual(compareIndexes(expected, { products: [...base, { ...good, collation: { locale: "simple" } }] }), []);
	const run = (index) => compareIndexes(expected, { products: [...base, index] }).map((r) => r.detail || r.type).join("|");
	assert.match(run({ ...good, partialFilterExpression: { a: 1 } }), /partialFilterExpression/);
	assert.match(run({ ...good, collation: { locale: "es" } }), /collation/);
	assert.match(run({ name: "codigo_1", key: { codigo: 1 }, unique: true }), /nombre esperado=e0_codigo_unique/);
});
