import assert from "node:assert/strict";
import test from "node:test";
import { buildDeleteBody, interpretDeleteResponse } from "../../catalogo-vgv/src/lib/utils/delete-product.js";

test("el cliente envía la versión esperada del producto al eliminar", () => {
	assert.deepEqual(JSON.parse(buildDeleteBody({ id: "1", updatedAt: "2026-10-23T12:00:00.000Z" })), {
		_expectedUpdatedAt: "2026-10-23T12:00:00.000Z"
	});
	assert.deepEqual(JSON.parse(buildDeleteBody({ id: "1" })), { _expectedUpdatedAt: null });
});

test("el cliente distingue conflicto, inexistente, éxito, limpieza pendiente y error", () => {
	assert.equal(interpretDeleteResponse(409, { error: "cambió" }).kind, "conflict");
	assert.match(interpretDeleteResponse(409, { error: "cambió" }).message, /No se eliminó/);
	assert.equal(interpretDeleteResponse(428).kind, "conflict");
	assert.equal(interpretDeleteResponse(404).kind, "missing");
	assert.equal(interpretDeleteResponse(200, { ok: true }).kind, "deleted");
	const pending = interpretDeleteResponse(200, { ok: true, referencesCleanup: "pending" });
	assert.equal(pending.kind, "deleted");
	assert.match(pending.message, /pendiente/);
	assert.deepEqual(interpretDeleteResponse(500, { error: "boom" }), { kind: "error", message: "boom" });
});
