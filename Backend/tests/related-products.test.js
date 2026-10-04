import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRelatedProductIds, validateRelatedProductIds } from "../utils/related-products.js";

test("normaliza, elimina duplicados y mantiene orden", () => {
	assert.deepEqual(normalizeRelatedProductIds([" 2 ", "3", "2"], "1"), ["2", "3"]);
	assert.deepEqual(normalizeRelatedProductIds([], "1"), []);
});

test("rechaza self, IDs inválidos, objetos y más de 20 selecciones", () => {
	for (const ids of [["1"], [""], [1], [{ $ne: null }], Array(21).fill("2"), null]) {
		assert.throws(() => normalizeRelatedProductIds(ids, "1"));
	}
});

test("valida existencia y permite quitar todas las asociaciones", async () => {
	const find = async (ids) => ids.filter((id) => id !== "missing").map((id) => ({ id }));
	assert.deepEqual(await validateRelatedProductIds(["2", "3"], "1", find), ["2", "3"]);
	assert.deepEqual(await validateRelatedProductIds([], "1", find), []);
	await assert.rejects(validateRelatedProductIds(["missing"], "1", find), /ya no existe/);
});