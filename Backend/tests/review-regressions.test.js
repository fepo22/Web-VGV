import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { once } from "node:events";
import { buildStockPatch, buildProductPatch } from "../../catalogo-vgv/src/lib/utils/save-product.js";
import { canResubmitRejectedImport, importRecoveryState, sendImportBatch } from "../../catalogo-vgv/src/lib/utils/import-recovery.js";
import { variantChoices, cartIdentity, cartIdentityError } from "../../catalogo-vgv/src/lib/utils/variant-identity.js";
import authMiddleware, { getJwtSecret } from "../middlewares/auth.js";
import { adminLimiter } from "../middlewares/rateLimit.js";

const batch = () => ({
	batchId: "synthetic-review-batch-123", products: [{ codigo: "SYNTH", stock: 0 }], submission: "notSent"
});
const json = (data, status) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

test("RI-01: altas distinguen cero, positivo y desconocido", () => {
	for (const value of [0, "0", 5, "5"]) assert.deepEqual(buildStockPatch(null, value), { stock: Number(value) });
	for (const value of [null, undefined, ""]) assert.deepEqual(buildStockPatch(null, value), {});
	for (const value of [NaN, -1, "texto", {}, false]) assert.throws(() => buildStockPatch(null, value), /Stock/);
});

test("RI-01: editar conserva desconocido, omite cantidad intacta y no altera otros campos", () => {
	for (const value of [5, "5"]) assert.deepEqual(buildStockPatch({ stock: 5 }, value), {});
	for (const value of [null, undefined, ""]) {
		assert.deepEqual(buildStockPatch({ stock: null }, value), {});
		assert.deepEqual(buildStockPatch({ stock: 0 }, value), { stock: null });
	}
	assert.deepEqual(buildStockPatch({ stock: null }, 0), { stock: 0 });
	const product = { nombre: "Original", stock: 5, variantes: [{ sku: "", medida: "legacy" }] };
	const before = structuredClone(product);
	assert.deepEqual(buildProductPatch(product, { nombre: "Original", ...buildStockPatch(product, 0) }), { stock: 0 });
	assert.deepEqual(product, before);
});

for (const status of [401, 403, 429]) {
	test(`RI-03: rechazo acreditado ${status}, consulta sin recibo y reenvío conservan identidad`, async () => {
		let pending = batch();
		const calls = [];
		const persist = (value) => { pending = value; };
		const rejected = await sendImportBatch({
			pending, persist, token: "synthetic", url: (p) => p,
			request: async (url, options) => {
				assert.equal(pending.submission, "unknown", "Persistir incertidumbre antes de enviar");
				calls.push(JSON.parse(options.body));
				return json({ importNotStarted: true, error: "Rejected" }, status);
			}
		});
		assert.equal(rejected.response.status, status);
		assert.equal(canResubmitRejectedImport(JSON.parse(JSON.stringify(pending)), null), true);
		// A GET 404 does not create a report or prove anything beyond the prior rejection.
		assert.equal(canResubmitRejectedImport(pending, null), true);
		const result = await sendImportBatch({
			pending, persist, token: "renewed-synthetic", url: (p) => p,
			request: async (url, options) => {
				calls.push(JSON.parse(options.body));
				return json({ batchId: pending.batchId, rows: [{ position: 0, status: "created" }], complete: true }, 200);
			}
		});
		assert.deepEqual(calls[1], calls[0]);
		assert.equal(result.data.complete, true);
		assert.equal(pending.submission, "confirmed");
		assert.equal(canResubmitRejectedImport(pending, null), false);
	});
}

test("RI-03: 404, rechazos sin prueba, 409/428/500 y pérdidas de respuesta no habilitan reenvío", async () => {
	for (const status of [401, 403, 429, 404, 409, 428, 500]) {
		let pending = batch();
		await sendImportBatch({ pending, persist: (p) => { pending = p; }, url: (p) => p, token: "synthetic",
			request: async () => json({ error: "No proof" }, status) });
		assert.equal(pending.submission, "unknown");
		assert.equal(canResubmitRejectedImport(pending, null), false);
	}
	for (const submission of ["notSent", "rejected", "unknown", undefined]) {
		let pending = { ...batch(), submission };
		await assert.rejects(sendImportBatch({ pending, persist: (p) => { pending = p; }, url: (p) => p, token: "synthetic",
			request: async () => { throw new TypeError("Response lost"); } }));
		assert.equal(pending.submission, "unknown");
		assert.equal(canResubmitRejectedImport(pending, null), false);
		// A later auth rejection cannot erase earlier ambiguity.
		await sendImportBatch({ pending, persist: (p) => { pending = p; }, url: (p) => p, token: "synthetic",
			request: async () => json({ importNotStarted: true }, 401) });
		assert.equal(canResubmitRejectedImport(pending, null), false);
	}
});

test("RI-03: recibo parcial prevalece, conserva filas y excluye confirmadas/unknown", async () => {
	let pending = batch();
	const report = { batchId: pending.batchId, complete: false, processing: false, unknown: 1, rows: [
		{ position: 0, status: "updated" }, { position: 1, status: "unknown" }, { position: 2, status: "failed" }
	] };
	const result = await sendImportBatch({ pending, persist: (p) => { pending = p; }, url: (p) => p, token: "synthetic",
		request: async () => json(report, 207) });
	assert.deepEqual(result.data, report);
	assert.equal(pending.submission, "started");
	assert.equal(canResubmitRejectedImport(pending, report), false);
	assert.deepEqual(importRecoveryState(pending, report).retryRows, [2]);
	assert.equal(importRecoveryState(pending, report).canArchive, false);
});

test("RI-03: prueba HTTP de rechazo real en auth/limiter sin ejecutar controlador", async () => {
	const app = express();
	let starts = 0;
	app.use("/admin/products", adminLimiter, authMiddleware);
	app.post("/admin/products/bulk", (req, res) => { starts += 1; res.json({ synthetic: true }); });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = `http://127.0.0.1:${server.address().port}/admin/products/bulk`;
	try {
		const denied = await fetch(address, { method: "POST" });
		assert.equal(denied.status, 401);
		assert.equal((await denied.json()).importNotStarted, true);
		const forbidden = await fetch(address, { method: "POST", headers: {
			Authorization: `Bearer ${jwt.sign({ role: "customer" }, getJwtSecret())}`
		} });
		assert.equal(forbidden.status, 403);
		assert.equal((await forbidden.json()).importNotStarted, true);
		assert.equal(starts, 0);
		let limited;
		for (let i = 0; i < 60; i += 1) {
			const response = await fetch(address, { method: "POST" });
			if (response.status === 429) { limited = response; break; }
		}
		assert.equal(limited?.status, 429);
		assert.equal((await limited.json()).importNotStarted, true);
		assert.equal(starts, 0);
	} finally {
		server.closeAllConnections();
		await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
});

test("RI-04: variantes con SKU único seleccionables; faltantes y duplicadas se conservan bloqueadas", () => {
	const variants = [
		{ sku: "A", medida: "10" }, { sku: "", medida: "20" }, { sku: "", medida: "25" },
		{ sku: "DUP", medida: "30" }, { sku: "DUP", medida: "40" }, { sku: " B ", medida: "50" }
	];
	const before = structuredClone(variants);
	assert.deepEqual(variantChoices(variants).map((c) => c.selectable), [true, false, false, false, false, false]);
	assert.deepEqual(variants, before);
	assert.deepEqual(variantChoices([{ sku: "A" }, { sku: " A " }]).map((c) => c.selectable), [false, false]);
	assert.equal(cartIdentity({ id: "p", varianteSku: "A", varianteMedida: "10", variantes: variants }), '["p","A"]');
	for (const varianteSku of ["", "DUP", " B "]) {
		assert.throws(() => cartIdentity({ id: "p", varianteSku, varianteMedida: "20", variantes: variants }));
	}
	assert.throws(() => cartIdentity({ id: "p", variantes: variants }), /Selecciona/);
});

test("RI-04: carrito no fusiona IDs/SKU distintos ni admite líneas ambiguas restauradas", () => {
	assert.notEqual(cartIdentity({ id: "a:b", varianteSku: "c" }), cartIdentity({ id: "a", varianteSku: "b:c" }));
	assert.notEqual(cartIdentity({ id: "p" }), cartIdentity({ id: "p", varianteSku: "p" }));
	assert.match(cartIdentityError([{ id: "p", varianteMedida: "20", varianteSku: "" }]), /SKU/);
	assert.match(cartIdentityError([{ id: "p", varianteSku: "A", varianteMedida: "20" },
		{ id: "p", varianteSku: "A", varianteMedida: "25" }]), /misma identidad/);
	assert.equal(cartIdentityError([{ id: "p", varianteSku: "A" }, { id: "p", varianteSku: "B" }]), "");
	assert.throws(() => cartIdentity({ varianteSku: "A" }), /identidad/);
});
