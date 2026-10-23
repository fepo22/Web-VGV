import assert from "node:assert/strict";
import test from "node:test";
import { canonicalProductCode, requireCodeIndex, CODE_INDEX_NAME, duplicateCodeError, diagnoseProductCodes } from "../utils/product-code.js";
import { importReport } from "../data/product-imports.store.js";
import { managedImageId } from "../utils/image-lifecycle.js";
import { importRecoveryState } from "../../catalogo-vgv/src/lib/utils/import-recovery.js";

test("códigos canónicos conservan reglas aprobadas sin descartar caracteres", () => {
	assert.equal(canonicalProductCode(" sku  17 "), "SKU-17");
	assert.equal(canonicalProductCode("A__--B"), "A__--B");
	for (const invalid of ["A/B", "á", "", {}, false, "x".repeat(81)]) assert.throws(() => canonicalProductCode(invalid));
});

test("índice no único, parcial, sparse o colación permisiva no acredita unicidad", async () => {
	const good = { name: CODE_INDEX_NAME, key: { codigo: 1 }, unique: true };
	for (const index of [
		{ ...good, unique: false }, { ...good, sparse: true },
		{ ...good, partialFilterExpression: { codigo: { $exists: true } } },
		{ ...good, collation: { locale: "en", strength: 2 } }, { ...good, key: { codigo: 1, id: 1 } }
	]) {
		await assert.rejects(requireCodeIndex({ collection: { indexes: async () => [index] } }), { code: "CODE_INDEX_REQUIRED" });
	}
	await requireCodeIndex({ collection: { indexes: async () => [good], findOne: async () => null } });
	await assert.rejects(requireCodeIndex({ collection: { indexes: async () => [good], findOne: async () => ({ _id: "legacy" }) } }), { code: "CODE_HISTORY_REVIEW_REQUIRED" });
});

test("duplicidad de código se distingue de otros índices", () => {
	assert.equal(duplicateCodeError({ code: 11000, keyPattern: { codigo: 1 } }).status, 409);
	const unrelated = { code: 11000, keyPattern: { _id: 1 } };
	assert.equal(duplicateCodeError(unrelated), unrelated);
});

test("diagnóstico histórico informa colisiones sin cambiar documentos", () => {
	const products = [{ id: "1", codigo: " ab c " }, { id: "2", codigo: "AB-C" }, { id: "3", codigo: "A/B" }];
	const before = structuredClone(products);
	const report = diagnoseProductCodes(products);
	assert.equal(report.collisions[0].products.length, 2);
	assert.equal(report.noncanonical.length, 1);
	assert.equal(report.invalid.length, 1);
	assert.deepEqual(products, before);
});

test("reporte durable no presenta applying como fallido ni divulga payload", () => {
	const report = importReport({ _id: "synthetic-batch", lock: "owner", rows: [
		{ position: 0, rowNumber: 2, status: "created", attempts: 1, payload: { precioCosto: 25 } },
		{ position: 1, rowNumber: 3, status: "applying", attempts: 1 },
		{ position: 2, rowNumber: 4, status: "failed", attempts: 1 },
		{ position: 3, rowNumber: 5, status: "rejected", attempts: 0 },
		{ position: 4, rowNumber: 6, status: "pending", attempts: 0 }
	] });
	assert.equal(report.confirmed, 1);
	assert.equal(report.unknown, 1);
	assert.equal(report.failed, 1);
	assert.equal(report.rejected, 1);
	assert.equal(report.unattempted, 1);
	assert.equal(report.attempted, 3);
	assert.equal(report.processed, 3);
	assert.equal(report.complete, false);
	assert.equal(report.rows[1].status, "unknown");
	assert.equal("payload" in report.rows[0], false);
});

test("panel vincula recuperación al mismo batch y excluye confirmadas y ambiguas", () => {
	const pending = { batchId: "current-batch" };
	const report = { batchId: pending.batchId, processing: false, unknown: 1, rows: [
		{ position: 0, status: "created" }, { position: 1, status: "updated" },
		{ position: 2, status: "unchanged" }, { position: 3, status: "unknown" },
		{ position: 4, status: "rejected" }, { position: 5, status: "failed" },
		{ position: 6, status: "pending" }, { position: 7, status: "conflict" }
	] };
	assert.deepEqual(importRecoveryState(pending, report), { retryRows: [5, 6, 7], canRetry: true, canArchive: false });
	assert.deepEqual(importRecoveryState(pending, { ...report, batchId: "previous-batch" }),
		{ retryRows: [], canRetry: false, canArchive: false });
	assert.equal(importRecoveryState(pending, { ...report, processing: true }).canRetry, false);
	assert.equal(importRecoveryState(pending, { ...report, unknown: 0 }).canArchive, true);
	assert.equal(importRecoveryState(null, report).canArchive, false);
	assert.equal(importRecoveryState(pending, null).canRetry, false);
});

test("identificación de referencias GridFS es independiente del origen absoluto", () => {
	const id = "0123456789abcdef01234567";
	assert.equal(String(managedImageId(`/api/product-images/${id}`)), id);
	assert.equal(String(managedImageId(`https://synthetic.invalid/api/product-images/${id}?v=1`)), id);
	assert.equal(String(managedImageId(`/API/product-images/${id}/`)), id);
	assert.equal(managedImageId("/images/static.png"), null);
});
