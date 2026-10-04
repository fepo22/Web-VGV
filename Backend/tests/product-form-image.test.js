import assert from "node:assert/strict";
import { test } from "node:test";
import {
	PRODUCT_IMAGE_PLACEHOLDER,
	ProductSaveError,
	saveProductWithImage,
} from "../../catalogo-vgv/src/lib/utils/save-product.js";

const token = "test-admin-token";
const url = (path) => `https://vgv.test${path}`;
const image = () => new Blob(["image bytes"], { type: "image/webp" });
const payload = () => ({
	nombre: "Producto de prueba",
	imagen: "blob:preview-only",
	precioCosto: 125,
	precio: 200,
	relatedProductIds: ["related-a", "related-b"],
	variantes: [{ sku: "SKU-1", medida: "10 mm", minima: 2 }],
});
const json = (data, status = 200) => new Response(JSON.stringify(data), {
	status,
	headers: { "content-type": "application/json" },
});

// Each step supplies a fresh native Response; no real HTTP or global fetch mutation.
function requestMock(...steps) {
	const calls = [];
	return {
		calls,
		request: async (address, options) => {
			calls.push({ address, ...options });
			assert.ok(calls.length <= steps.length, "Solicitud inesperada");
			const step = steps[calls.length - 1];
			if (step instanceof Error) throw step;
			return step;
		},
	};
}

function options(mock, extra = {}) {
	return { payload: payload(), token, url, request: mock.request, ...extra };
}

async function checkUpload(call, id, expectedImage) {
	assert.equal(call.address, url("/admin/products/images"));
	assert.equal(call.method, "POST");
	const headers = new Headers(call.headers);
	assert.equal(headers.get("authorization"), `Bearer ${token}`);
	assert.equal(headers.has("content-type"), false);
	assert.ok(call.body instanceof FormData);
	assert.deepEqual([...call.body.keys()], ["productId", "expectedImage", "overwrite", "image"]);
	assert.equal(call.body.get("productId"), String(id));
	assert.equal(call.body.get("expectedImage"), expectedImage);
	assert.equal(call.body.get("overwrite"), String(Boolean(expectedImage)));
	const file = call.body.get("image");
	assert.ok(file instanceof Blob);
	assert.equal(file.name, "product.webp");
	assert.equal(file.type, "image/webp");
	assert.equal(await file.text(), "image bytes");
}

test("crear con archivo: JSON placeholder y luego multipart autenticado con ID confirmado", async () => {
	const input = payload();
	const saved = { ...input, id: "new/id", imagen: PRODUCT_IMAGE_PLACEHOLDER };
	const uploaded = { id: saved.id, imagen: "/api/product-images/new-image" };
	const mock = requestMock(json(saved, 201), json({ product: uploaded }));
	const callbacks = [];
	const result = await saveProductWithImage(options(mock, {
		payload: input,
		image: image(),
		onProductSaved(product) {
			assert.equal(mock.calls.length, 1, "Callback anterior al upload");
			callbacks.push(product);
		},
	}));
	assert.equal(mock.calls.length, 2);
	assert.equal(mock.calls[0].address, url("/admin/products"));
	assert.equal(mock.calls[0].method, "POST");
	assert.equal(new Headers(mock.calls[0].headers).get("authorization"), `Bearer ${token}`);
	assert.equal(new Headers(mock.calls[0].headers).get("content-type"), "application/json");
	assert.deepEqual(JSON.parse(mock.calls[0].body), { ...input, imagen: PRODUCT_IMAGE_PLACEHOLDER });
	assert.ok(!mock.calls[0].body.includes("blob:"));
	assert.equal(input.imagen, "blob:preview-only", "No mutar payload");
	await checkUpload(mock.calls[1], saved.id, PRODUCT_IMAGE_PLACEHOLDER);
	assert.deepEqual(callbacks, [saved]);
	assert.deepEqual(result, { ...saved, ...uploaded });
});

test("crear: respuesta parcial {id, imagen} conserva costo, relaciones y variantes", async () => {
	const input = payload();
	const saved = { id: "new-product", imagen: PRODUCT_IMAGE_PLACEHOLDER };
	const uploaded = { id: saved.id, imagen: "/images/new.webp" };
	const mock = requestMock(json(saved, 201), json({ product: uploaded }));
	const callbacks = [];
	const result = await saveProductWithImage(options(mock, {
		payload: input, image: image(), onProductSaved: (product) => callbacks.push(product),
	}));
	assert.deepEqual(result, { ...input, ...uploaded });
	assert.deepEqual(callbacks, [{ ...input, ...saved }]);
});

test("editar con archivo: PUT sin imagen y expectedImage original, no metadata concurrente", async () => {
	const existingProduct = { ...payload(), id: "existing/id", imagen: "/images/observed.webp" };
	const saved = { ...existingProduct, imagen: "/images/concurrent.webp" };
	const mock = requestMock(json(saved), json({ product: { id: saved.id, imagen: "/images/uploaded.webp" } }));
	const result = await saveProductWithImage(options(mock, { existingProduct, image: image() }));
	assert.equal(mock.calls.length, 2);
	assert.equal(mock.calls[0].address, url("/admin/products/existing%2Fid"));
	assert.equal(mock.calls[0].method, "PUT");
	const { imagen: ignoredImage, ...expectedBody } = payload();
	assert.deepEqual(JSON.parse(mock.calls[0].body), expectedBody);
	assert.equal(Object.hasOwn(JSON.parse(mock.calls[0].body), "imagen"), false);
	await checkUpload(mock.calls[1], saved.id, existingProduct.imagen);
	assert.deepEqual(result.relatedProductIds, existingProduct.relatedProductIds);
	assert.equal(existingProduct.imagen, "/images/observed.webp");
});

test("editar: metadata y upload parciales no pierden relaciones existentes ni campos enviados", async () => {
	const existingProduct = { ...payload(), id: "existing", imagen: "/images/old.webp", descripcion: "Conservar" };
	const input = { nombre: "Nombre actualizado", precioCosto: 150, variantes: payload().variantes };
	const saved = { id: existingProduct.id, imagen: "/images/concurrent.webp" };
	const uploaded = { id: existingProduct.id, imagen: "/images/new.webp" };
	const mock = requestMock(json(saved), json({ product: uploaded }));
	const callbacks = [];
	const result = await saveProductWithImage(options(mock, {
		payload: input, existingProduct, image: image(), onProductSaved: (product) => callbacks.push(product),
	}));
	assert.deepEqual(result, { ...existingProduct, ...input, ...uploaded });
	assert.deepEqual(callbacks, [{ ...existingProduct, ...input, ...saved }]);
});

for (const editing of [false, true]) {
	test(`guardar URL sin archivo (${editing ? "editar" : "crear"}): no upload`, async () => {
		const input = { ...payload(), imagen: "https://cdn.test/product.webp" };
		const saved = { ...input, id: "url-product" };
		const mock = requestMock(json(saved));
		const callbacks = [];
		const result = await saveProductWithImage(options(mock, {
			payload: input, existingProduct: editing ? saved : null,
			onProductSaved: (product) => callbacks.push(product),
		}));
		assert.equal(mock.calls.length, 1);
		assert.equal(mock.calls[0].method, editing ? "PUT" : "POST");
		assert.deepEqual(JSON.parse(mock.calls[0].body), input);
		assert.deepEqual(result, saved);
		assert.deepEqual(callbacks, [saved]);
	});
}

for (const failure of [422, 401, 403, "network", "invalid"]) {
	test(`fallo metadata ${failure}: no upload ni callback`, async () => {
		const step = failure === "network" ? new TypeError("Network failure")
			: failure === "invalid" ? json({ id: "unconfirmed" })
				: json({ error: "Metadata rechazada" }, failure);
		const mock = requestMock(step);
		const callbacks = [];
		await assert.rejects(saveProductWithImage(options(mock, {
			image: image(), onProductSaved: (product) => callbacks.push(product),
		})), (error) => {
			if (typeof failure === "number") {
				assert.ok(error instanceof ProductSaveError);
				assert.equal(error.status, failure);
				assert.equal(error.savedProduct, null);
				assert.equal(error.imageFailed, false);
			} else if (failure === "invalid") assert.ok(error instanceof ProductSaveError);
			else assert.equal(error, step);
			return true;
		});
		assert.equal(mock.calls.length, 1);
		assert.deepEqual(callbacks, []);
	});
}

for (const failure of [409, "network", 401, 403]) {
	test(`fallo imagen ${failure}: producto confirmado, callback y retry PUT sin recrear`, async () => {
		const saved = { ...payload(), id: "confirmed-product", imagen: PRODUCT_IMAGE_PLACEHOLDER };
		const step = failure === "network" ? new TypeError("Network failure") : json({ error: "Imagen rechazada" }, failure);
		const mock = requestMock(json(saved, 201), step);
		const callbacks = [];
		let captured;
		await assert.rejects(saveProductWithImage(options(mock, {
			image: image(), onProductSaved: (product) => callbacks.push(product),
		})), (error) => {
			assert.ok(error instanceof ProductSaveError);
			assert.equal(error.imageFailed, true);
			assert.deepEqual(error.savedProduct, saved);
			assert.equal(error.status, failure === "network" ? 0 : failure);
			assert.match(error.message, /ficha quedó guardada/);
			captured = error;
			return true;
		});
		assert.equal(mock.calls.length, 2);
		assert.deepEqual(callbacks, [saved]);
		const uploaded = { id: saved.id, imagen: "/images/retry.webp" };
		const retry = requestMock(json(saved), json({ product: uploaded }));
		const result = await saveProductWithImage(options(retry, {
			existingProduct: captured.savedProduct, image: image(),
			onProductSaved: (product) => callbacks.push(product),
		}));
		assert.equal(retry.calls.length, 2);
		assert.equal(retry.calls[0].address, url(`/admin/products/${saved.id}`));
		assert.equal(retry.calls[0].method, "PUT", "Nunca POST para metadata en retry");
		assert.equal(Object.hasOwn(JSON.parse(retry.calls[0].body), "imagen"), false);
		await checkUpload(retry.calls[1], saved.id, saved.imagen);
		assert.deepEqual(result, { ...saved, ...uploaded });
		assert.deepEqual(callbacks, [saved, saved]);
	});
}