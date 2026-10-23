import assert from "node:assert/strict";
import test from "node:test";
import { proxyProductById, proxyProductList } from "../../catalogo-vgv/src/lib/utils/products-proxy.js";

const mapProduct = (product) => product;
const backendUrl = "https://backend.invalid";

test("catálogo backend vacío conserva 200 con arreglo vacío", async () => {
	const response = await proxyProductList({
		backendUrl,
		mapProduct,
		fetcher: async () => new Response("[]", { status: 200 })
	});
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), []);
});

test("error del backend no se transforma en productos de ejemplo ni éxito", async () => {
	const originalError = console.error;
	console.error = () => {};
	try {
		const response = await proxyProductList({
			backendUrl,
			mapProduct,
			fetcher: async () => new Response("failure", { status: 500 })
		});
		assert.equal(response.status, 502);
		assert.deepEqual(await response.json(), { error: "No se pudo consultar el catálogo." });
	} finally {
		console.error = originalError;
	}
});

test("detalle distingue producto inexistente de fallo del backend", async () => {
	const originalError = console.error;
	console.error = () => {};
	try {
		const notFound = await proxyProductById({
			backendUrl,
			id: "missing",
			mapProduct,
			fetcher: async () => new Response("{}", { status: 404 })
		});
		const failure = await proxyProductById({
			backendUrl,
			id: "17",
			mapProduct,
			fetcher: async () => new Response("failure", { status: 503 })
		});
		assert.equal(notFound.status, 404);
		assert.equal(failure.status, 502);
	} finally {
		console.error = originalError;
	}
});
