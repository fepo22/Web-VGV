import assert from "node:assert/strict";
import { test } from "node:test";
import {
	PRODUCT_IMAGE_PLACEHOLDER,
	ProductSaveError,
	buildProductPatch,
	saveProductWithImage,
	shouldRefreshSavedProduct,
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

test("editar producto solo envía campos realmente modificados", () => {
	const existingProduct = {
		id: "existing",
		nombre: "Nombre anterior",
		codigo: "SKU-1",
		descripcion: "Descripción",
		precioCosto: 125,
		familia: "Tuberías",
		familiaSlug: "tuberias",
		subfamilia: "PVC",
		subfamiliaSlug: "pvc",
		categoria: "",
		categoriaSlug: "",
		imagen: "/api/product-images/existing",
		relatedProductIds: ["related-a"],
		stock: null,
		estado: "disponible",
		variantes: [{ sku: "SKU-1", medida: "10 mm", minima: 2, legacy: "preserve" }]
	};
	const patch = buildProductPatch(existingProduct, {
		nombre: "Nombre nuevo",
		codigo: "SKU-1",
		descripcion: "Descripción",
		precioCosto: 125,
		familia: "Tuberías",
		familiaSlug: "tuberias",
		subfamilia: "PVC",
		subfamiliaSlug: "pvc",
		categoria: "",
		categoriaSlug: "",
		imagen: "/api/product-images/existing",
		relatedProductIds: ["related-a"],
		estado: "disponible",
		variantes: [{ sku: "SKU-1", medida: "10 mm", minima: 2 }]
	});
	assert.deepEqual(patch, { nombre: "Nombre nuevo" });
});

test("edición sin cambios no envía un PUT vacío", async () => {
	const existingProduct = { id: "existing", imagen: "/images/known.webp" };
	const mock = requestMock();
	let saved;
	const result = await saveProductWithImage(options(mock, {
		payload: {},
		existingProduct,
		onProductSaved: (product) => { saved = product; }
	}));
	assert.equal(mock.calls.length, 0);
	assert.equal(result, existingProduct);
	assert.equal(saved, existingProduct);
});

test("editar solo imagen sube archivo sin enviar metadata vacía", async () => {
	const existingProduct = { id: "existing", imagen: "/images/known.webp" };
	const mock = requestMock(json({
		product: { id: "existing", imagen: "/api/product-images/new-image" }
	}));
	const result = await saveProductWithImage(options(mock, {
		payload: {},
		existingProduct,
		image: image()
	}));
	assert.equal(mock.calls.length, 1);
	await checkUpload(mock.calls[0], "existing", existingProduct.imagen);
	assert.equal(result.imagen, "/api/product-images/new-image");
});

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
	assert.deepEqual(JSON.parse(mock.calls[0].body), { ...expectedBody, _expectedUpdatedAt: null });
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
		assert.deepEqual(
			JSON.parse(mock.calls[0].body),
			editing ? { ...input, _expectedUpdatedAt: null } : input
		);
		assert.deepEqual(result, saved);
		assert.deepEqual(callbacks, [saved]);
	});
}

test("conflicto 409 conserva la versión original para impedir reintento silencioso", async () => {
	const existingProduct = {
		id: "existing",
		nombre: "Nombre cargado",
		imagen: "/images/existing.webp",
		updatedAt: "2026-10-23T12:00:00.000Z"
	};
	const mock = requestMock(json({ error: "El producto cambió desde que lo cargaste." }, 409));
	await assert.rejects(
		saveProductWithImage(options(mock, {
			payload: { nombre: "Cambio local" },
			existingProduct
		})),
		(error) => {
			assert.ok(error instanceof ProductSaveError);
			assert.equal(error.status, 409);
			assert.equal(error.savedProduct, existingProduct);
			return true;
		}
	);
	assert.equal(
		JSON.parse(mock.calls[0].body)._expectedUpdatedAt,
		"2026-10-23T12:00:00.000Z"
	);
});

for (const status of [400, 409, 428, 500]) {
	test(`PUT HTTP ${status} no sube imagen, no confirma guardado ni habilita refresco de versión`, async () => {
		const existingProduct = {
			id: "existing", imagen: "/old", updatedAt: "2026-10-23T12:00:00.000Z"
		};
		const mock = requestMock(json({ error: "Rechazado" }, status));
		let confirmed = false;
		await assert.rejects(saveProductWithImage(options(mock, {
			payload: { nombre: "Borrador" }, existingProduct, image: image(),
			onProductSaved: () => { confirmed = true; }
		})), (error) => {
			assert.equal(error.status, status);
			assert.equal(error.savedProduct, existingProduct);
			assert.equal(shouldRefreshSavedProduct(error), false);
			return true;
		});
		assert.equal(mock.calls.length, 1);
		assert.equal(confirmed, false);
		assert.equal(JSON.parse(mock.calls[0].body)._expectedUpdatedAt, existingProduct.updatedAt);
	});
}

test("solo fallos de imagen o confirmación local habilitan recuperación de imagen", () => {
	const savedProduct = { id: "17", updatedAt: "original" };
	assert.equal(shouldRefreshSavedProduct(new ProductSaveError("Upload conflict", {
		savedProduct, status: 409, imageFailed: true
	})), true);
	assert.equal(shouldRefreshSavedProduct(new ProductSaveError("Upload", {
		savedProduct, status: 500, imageFailed: true
	})), true);
	assert.equal(shouldRefreshSavedProduct(new ProductSaveError("Panel", { savedProduct })), true);
});

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
			assert.equal(shouldRefreshSavedProduct(error), true, "No descartar identidad confirmada por status de upload");
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

test("RI-02: alta201 + upload409 recupera ID y reintenta únicamente imagen sin adoptar versión concurrente", async () => {
	const saved = { id: "confirmed-review", imagen: PRODUCT_IMAGE_PLACEHOLDER, updatedAt: "2026-10-23T12:00:00.000Z" };
	const mock = requestMock(json(saved, 201), json({ error: "Imagen concurrente" }, 409));
	let recovered;
	await assert.rejects(saveProductWithImage(options(mock, { image: image() })), (error) => {
		assert.equal(shouldRefreshSavedProduct(error), true);
		recovered = { ...error.savedProduct, imagen: "/images/observed-concurrent.webp" };
		assert.equal(recovered.updatedAt, saved.updatedAt);
		return true;
	});
	const retry = requestMock(json({ product: { id: saved.id, imagen: "/images/retry.webp" } }));
	await saveProductWithImage(options(retry, { payload: {}, existingProduct: recovered, image: image() }));
	assert.equal(retry.calls.length, 1);
	await checkUpload(retry.calls[0], saved.id, recovered.imagen);
	assert.equal(mock.calls.filter((call) => call.address === url("/admin/products")).length, 1);
});