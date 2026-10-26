import assert from "node:assert/strict";
import test from "node:test";
import { loadProductDetail } from "../../catalogo-vgv/src/lib/utils/product-detail.js";

const reply = (status, body) => async () => ({
	ok: status >= 200 && status < 300,
	status,
	json: async () => body
});

test("detalle: 404 se presenta como producto inexistente", async () => {
	const result = await loadProductDetail(reply(404, { error: "Producto no encontrado" }), "17");
	assert.deepEqual(result, { producto: null, notFound: true, loadError: "" });
});

test("detalle: 5xx, 502 y fallo de red son error recuperable, no inexistente", async () => {
	const originalError = console.error;
	console.error = () => {};
	try {
		for (const fetcher of [
			reply(500, {}), reply(502, {}), reply(503, {}),
			async () => { throw new TypeError("fetch failed"); }
		]) {
			const result = await loadProductDetail(fetcher, "17");
			assert.equal(result.producto, null);
			assert.equal(result.notFound, false);
			assert.match(result.loadError, /No se pudo cargar/);
		}
	} finally {
		console.error = originalError;
	}
});

test("detalle: respuesta válida devuelve el producto y cuerpo inválido es error", async () => {
	const ok = await loadProductDetail(reply(200, { id: "17", nombre: "Tubo" }), "17");
	assert.equal(ok.producto.id, "17");
	assert.equal(ok.loadError, "");
	const invalid = await loadProductDetail(reply(200, null), "17");
	assert.equal(invalid.producto, null);
	assert.ok(invalid.loadError);
});

test("detalle: el id se codifica en la URL", async () => {
	let url;
	await loadProductDetail(async (value) => { url = value; return { ok: false, status: 404 }; }, "a/b c");
	assert.equal(url, "/api/products/a%2Fb%20c");
});
