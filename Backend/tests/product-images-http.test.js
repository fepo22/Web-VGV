import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../middlewares/auth.js";
import { applySecurity } from "../middlewares/security.middleware.js";
import productsRoutes from "../routes/products.routes.js";
import productImagesRoutes from "../routes/product-images.routes.js";
import { MAX_IMAGE_BYTES } from "../utils/product-image.js";

// App real de middlewares/rutas, sin conexión Mongo ni secretos en salida.
test("HTTP: auth, multer memory, límites globales y validación multipart post-sanitize", async () => {
	const app = express();
	app.set("trust proxy", 1);
	app.use(express.json({ limit: "10kb" }));
	app.use(express.urlencoded({ extended: true, limit: "10kb" }));
	applySecurity(app);
	app.use("/admin/products", productsRoutes);
	app.use("/api/product-images", productImagesRoutes);
	const server = await new Promise((resolve) => {
		const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
	});
	const base = `http://127.0.0.1:${server.address().port}`;
	const adminToken = jwt.sign({ role: "admin" }, getJwtSecret(), { expiresIn: "5m" });
	const customerToken = jwt.sign({ role: "customer" }, getJwtSecret(), { expiresIn: "5m" });
	const headers = { Authorization: `Bearer ${adminToken}`, "User-Agent": "VGV-image-tests" };
	const makeForm = () => {
		const body = new FormData();
		body.append("expectedImage", "");
		return body;
	};
	try {
		const unauthorized = await fetch(`${base}/admin/products/images`, { method: "POST", headers: { "User-Agent": "VGV-image-tests" } });
		assert.equal(unauthorized.status, 401);
		await unauthorized.arrayBuffer();
		const forbidden = await fetch(`${base}/admin/products/images`, { method: "POST", headers: { ...headers, Authorization: `Bearer ${customerToken}` } });
		assert.equal(forbidden.status, 403);
		await forbidden.arrayBuffer();
		const wrongType = await fetch(`${base}/admin/products/images`, { method: "POST", headers });
		assert.equal(wrongType.status, 415);
		await wrongType.arrayBuffer();

		// Payload >10kb pasa el parser JSON global, pero el campo faltante es rechazado
		// antes de tocar Mongo. Así se verifica que JSON no consume multipart.
		const body = makeForm();
		body.append("image", new Blob([Buffer.alloc(20_000)], { type: "image/jpeg" }), "fake.jpg");
		const missingId = await fetch(`${base}/admin/products/images`, { method: "POST", headers, body });
		assert.equal(missingId.status, 400);
		assert.match((await missingId.json()).error, /ID explícito/);
		assert.match(missingId.headers.get("content-security-policy"), /img-src[^;]*blob:/);

		const extraFiles = makeForm();
		extraFiles.append("image", new Blob(["first"]), "first.jpg");
		extraFiles.append("image", new Blob(["second"]), "second.jpg");
		const extra = await fetch(`${base}/admin/products/images`, { method: "POST", headers, body: extraFiles });
		assert.equal(extra.status, 400);
		await extra.arrayBuffer();

		const oversized = makeForm();
		oversized.append("image", new Blob([Buffer.alloc(MAX_IMAGE_BYTES + 1)]), "big.jpg");
		const tooBig = await fetch(`${base}/admin/products/images`, { method: "POST", headers, body: oversized });
		assert.equal(tooBig.status, 413);
		await tooBig.arrayBuffer();

		const injection = makeForm();
		injection.append("productId[$ne]", "");
		const malicious = await fetch(`${base}/admin/products/images`, { method: "POST", headers, body: injection });
		assert.equal(malicious.status, 400);
		await malicious.arrayBuffer();
		const fieldOverflow = makeForm();
		fieldOverflow.append("productId", "1".repeat(2049));
		const badField = await fetch(`${base}/admin/products/images`, { method: "POST", headers, body: fieldOverflow });
		assert.equal(badField.status, 400);
		await badField.arrayBuffer();

		const invalidImageId = await fetch(`${base}/api/product-images/not-an-objectid`);
		assert.equal(invalidImageId.status, 404);
		await invalidImageId.arrayBuffer();
	} finally {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	}
});