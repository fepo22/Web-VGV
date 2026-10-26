import assert from "node:assert/strict";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { barrier, withMethod, verifyIntegrationEnvironment, verifyOwner, verifyDisconnected, cleanEnvironment } from "./e0-support.mjs";

// Not a *.test.* file: normal `node --test` must never launch this integration.
// No DB/application modules at module scope. Only the verified runner calls this.
export async function createSuite({ mongoose, runId, report, interrupted }) {
	const port = Number(new URL(process.env.MONGO_URI).port);
	verifyIntegrationEnvironment(process.env, port, runId);
	const config = JSON.parse(process.env.E0_INTEGRATION_CONFIG);
	await verifyOwner(config.root, config.owner);
	verifyDisconnected(mongoose.connection);
	assert.equal(mongoose.get("autoIndex"), false);
	assert.equal(mongoose.get("autoCreate"), false);
	const store = await import("../data/products.store.js");
	const images = await import("../data/product-images.store.js");
	const controllers = await import("../controllers/products.controller.js");
	const imageControllers = await import("../controllers/product-images.controller.js");
	const { processProductImage } = await import("../utils/product-image.js");
	const { default: express } = await import("express");
	const { default: sharp } = await import("sharp");
	await store.connectProductsDatabase();
	const db = mongoose.connection.db;
	const model = mongoose.model("Product");
	const collection = db.collection(model.collection.name);
	const prefix = `E0-${runId.toUpperCase()}-`;
	const ids = new Set();
	const fileIds = new Map();
	const batchIds = new Set();
	const token = `synthetic-${runId}`;
	let server;
	let origin;
	let serial = 0;
	const initialDate = new Date("2026-01-02T03:04:05.000Z");
	const ownId = (label) => `${prefix}${String(label).toUpperCase()}`;
	const fixture = async (label, extra = {}) => {
		const id = ownId(label);
		ids.add(id);
		const document = {
			id, codigo: id, nombre: `Synthetic ${label}`, descripcion: "original",
			imagen: "/synthetic-placeholder.webp", familia: "Synthetic", subfamilia: "Synthetic",
			precioCosto: 43, stock: null, estado: "disponible", relatedProductIds: [],
			variantes: [{ sku: "SYNTH", medida: "synthetic", minima: 1 }],
			createdAt: initialDate, updatedAt: initialDate, e0RunId: runId, ...extra
		};
		await collection.insertOne(document);
		return document;
	};
	const read = (id) => collection.findOne({ id });
	const json = async (method, route, body) => {
		const response = await fetch(`${origin}${route}`, {
			method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(20000)
		});
		return { status: response.status, body: await response.json() };
	};
	const put = (id, body) => json("PUT", `/products/${encodeURIComponent(id)}`, body);
	const imported = (products, extra = {}) => {
		const batchId = extra.batchId || `E0-${runId}-${serial++}`;
		batchIds.add(batchId);
		return json("POST", "/import", { batchId, products, ...extra });
	};
	const row = (label, extra = {}) => ({
		codigo: ownId(label), nombre: `Synthetic ${label}`, familia: "Synthetic",
		subfamilia: "Synthetic", precioCosto: 12, ...extra
	});
	const bytes = async (id) => {
		const bucket = await images.getImageBucket();
		const chunks = [];
		for await (const chunk of bucket.openDownloadStream(id)) chunks.push(chunk);
		return Buffer.concat(chunks);
	};
	const upload = async (product, buffer) => {
		const form = new FormData();
		form.set("productId", product.id);
		form.set("expectedImage", product.imagen);
		form.set("overwrite", "true");
		form.set("image", new Blob([buffer], { type: "image/png" }), "synthetic.png");
		const response = await fetch(`${origin}/images`, {
			method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
			signal: AbortSignal.timeout(25000)
		});
		return { status: response.status, body: await response.json() };
	};
	const check = async (name, action) => {
		assert.equal(interrupted(), false);
		try {
			const evidence = await action();
			report.checks.push({ name, status: "passed", ...(evidence === undefined ? {} : { evidence }) });
		} catch (error) {
			report.checks.push({ name, status: "failed", type: error.name });
			throw error; // fail fast, but always clean up
		}
	};
	const finding = (id, observation) => report.findings.push({ id, observation });

	// Track only synthetic import inserts; never replace a database operation.
	const realBulk = model.bulkWrite;
	const realCreate = model.create;
	model.create = async function (document, ...options) {
		assert.ok(document.codigo.startsWith(prefix));
		ids.add(document.id);
		return realCreate.call(this, document, ...options);
	};
	model.bulkWrite = async function (operations, options) {
		for (const operation of operations) {
			if (operation.insertOne) {
				const document = operation.insertOne.document;
				assert.ok(document.codigo.startsWith(prefix));
				ids.add(document.id);
			} else {
				assert.ok(ids.has(operation.updateOne.filter.id));
			}
		}
		return realBulk.call(this, operations, options);
	};
	// Add run ownership to all real GridFS uploads, including controller uploads.
	const bucketPrototype = mongoose.mongo.GridFSBucket.prototype;
	const realUpload = bucketPrototype.openUploadStream;
	bucketPrototype.openUploadStream = function (name, options = {}) {
		assert.ok(options.metadata?.e0RunId === runId || ids.has(options.metadata?.productId));
		const stream = realUpload.call(this, name, {
			...options, metadata: { ...options.metadata, e0RunId: runId }
		});
		fileIds.set(String(stream.id), stream.id);
		return stream;
	};

	// Retain Mongoose's original query execution; the barrier is immediately before
	// constructing/executing the actual CAS. No simulated match or DB result.
	const casRace = async (id, action) => {
		const gate = barrier(2, 10000);
		const result = await withMethod(model, "findOneAndUpdate", (original) => function (...args) {
			if (args[0].id !== id) return original.apply(this, args);
			assert.equal(args[2].timestamps, false);
			const self = this;
			return { lean: async () => {
				await gate.arrive();
				return original.apply(self, args).lean();
			} };
		}, action);
		assert.equal(gate.arrivals, 2);
		return result;
	};

	async function run() {
		const app = express();
		app.use(express.json({ limit: "1mb" }));
		const { default: productsRouter } = await import("../routes/products.routes.js");
		app.use("/admin/products", productsRouter);
		app.use((req, res, next) => {
			if (req.headers.authorization !== `Bearer ${token}`) return res.sendStatus(401);
			req.admin = { id: ownId("ADMIN"), synthetic: true };
			next();
		});
		app.put("/products/:id", controllers.updateProductController);
		app.get("/products/:id", controllers.getAdminProductById);
		app.post("/import", controllers.bulkImportProductsController);
		app.get("/import/:batchId", controllers.getProductImportController);
		app.post("/products", controllers.createProductController);
		app.post("/images", imageControllers.receiveProductImage, imageControllers.uploadProductImage);
		app.get("/image/:id", imageControllers.getPublicProductImage);
		server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		origin = `http://127.0.0.1:${server.address().port}`;
		await check("HTTP synthetic authentication", async () => {
			assert.equal((await fetch(`${origin}/products/absent`, { signal: AbortSignal.timeout(5000) })).status, 401);
		});

		const checkRejectedRecovery = () => check("RI-03 pre-controller rejection, absent receipt and stable batch recovery with real Mongo", async () => {
			const { sendImportBatch, canResubmitRejectedImport } = await import("../../catalogo-vgv/src/lib/utils/import-recovery.js");
			const { default: jwt } = await import("jsonwebtoken");
			const { getJwtSecret } = await import("../middlewares/auth.js");
			const batchId = `E0-${runId}-rejected-recovery`;
			batchIds.add(batchId);
			const products = [row("REJECTED-RECOVERY")];
			let pending = { batchId, products, submission: "notSent" };
			const send = (token) => sendImportBatch({
				pending, token, url: (route) => `${origin}${route}`,
				persist: (value) => { pending = value; }
			});
			const rejected = await send("synthetic-invalid-token");
			assert.equal(rejected.response.status, 401);
			assert.equal(rejected.data.importNotStarted, true);
			assert.equal(await db.collection("productImportReceipts").findOne({ _id: batchId }), null);
			assert.equal(await collection.countDocuments({ codigo: products[0].codigo }), 0);
			const token = jwt.sign({ role: "admin" }, getJwtSecret());
			const receipt = await fetch(`${origin}/admin/products/bulk/${batchId}`, { headers: { Authorization: `Bearer ${token}` } });
			assert.equal(receipt.status, 404);
			assert.equal(canResubmitRejectedImport(pending, null), true);
			const recovered = await send(token);
			assert.equal(recovered.response.status, 200);
			assert.equal(recovered.data.created, 1);
			assert.equal(pending.batchId, batchId);
			assert.equal(pending.submission, "confirmed");
			const before = await collection.findOne({ codigo: products[0].codigo });
			const replay = await send(token);
			assert.equal(replay.data.created, 1);
			assert.equal(await collection.countDocuments({ codigo: products[0].codigo }), 1);
			assert.equal((await read(before.id)).updatedAt.getTime(), before.updatedAt.getTime());
			return { rejectedBeforeReceipt: true, stableBatchRecovered: true, replayWithoutWrite: true };
		});

		await check("PUT normal / 428 / 400 / 409 / missing / reference missing", async () => {
			const p = await fixture("PUT");
			assert.equal((await put(p.id, { nombre: "not applied" })).status, 428);
			for (const token of ["invalid", "2026-02-30T00:00:00Z", 42]) {
				assert.equal((await put(p.id, { _expectedUpdatedAt: token, nombre: "not applied" })).status, 400);
			}
			assert.equal((await put(p.id, { _expectedUpdatedAt: p.updatedAt.toISOString(), relatedProductIds: [ownId("ABSENT")] })).status, 400);
			assert.equal((await read(p.id)).nombre, p.nombre);
			const saved = await put(p.id, { _expectedUpdatedAt: p.updatedAt.toISOString(), nombre: "confirmed" });
			assert.equal(saved.status, 200);
			assert.ok(new Date(saved.body.updatedAt) > p.updatedAt);
			assert.equal((await put(p.id, { _expectedUpdatedAt: p.updatedAt.toISOString(), descripcion: "loser" })).status, 409);
			const current = await read(p.id);
			assert.equal(current.nombre, "confirmed");
			assert.equal(current.descripcion, "original");
			assert.equal(current.precioCosto, 43);
			assert.equal((await put(ownId("ABSENT"), { _expectedUpdatedAt: null, nombre: "absent" })).status, 404);
		});

		await check("PUT BSON absent/null/corrupt/future versions", async () => {
			for (const kind of ["absent", "null"]) {
				const p = await fixture(`VERSION-${kind}`, { updatedAt: null });
				if (kind === "absent") await collection.updateOne({ id: p.id }, { $unset: { updatedAt: "" } });
				const loaded = await json("GET", `/products/${p.id}`);
				assert.equal(loaded.body.updatedAt, null);
				assert.equal((await put(p.id, { _expectedUpdatedAt: null, nombre: "first" })).status, 200);
				assert.equal((await put(p.id, { _expectedUpdatedAt: null, nombre: "second" })).status, 409);
				assert.ok((await read(p.id)).updatedAt instanceof Date);
			}
			const corrupt = await fixture("VERSION-CORRUPT", { updatedAt: "not-a-bson-date" });
			assert.equal((await put(corrupt.id, { _expectedUpdatedAt: null, nombre: "bad" })).status, 409);
			assert.equal((await put(corrupt.id, { _expectedUpdatedAt: initialDate.toISOString(), nombre: "bad" })).status, 409);
			assert.equal((await read(corrupt.id)).updatedAt, "not-a-bson-date");
			const future = await fixture("VERSION-FUTURE", { updatedAt: new Date("2099-01-01T00:00:00Z") });
			const saved = await put(future.id, { _expectedUpdatedAt: future.updatedAt.toISOString(), nombre: "future" });
			assert.equal(saved.status, 200);
			assert.ok((await read(future.id)).updatedAt > future.updatedAt);
		});

		await check("PUT two HTTP requests / same snapshot / distinct fields / real CAS barrier", async () => {
			const p = await fixture("CAS");
			const responses = await casRace(p.id, () => Promise.all([
				put(p.id, { _expectedUpdatedAt: p.updatedAt.toISOString(), nombre: "winner-name" }),
				put(p.id, { _expectedUpdatedAt: p.updatedAt.toISOString(), descripcion: "winner-description" })
			]));
			assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
			const final = await read(p.id);
			const firstWon = responses[0].status === 200;
			assert.equal(final.nombre, firstWon ? "winner-name" : p.nombre);
			assert.equal(final.descripcion, firstWon ? p.descripcion : "winner-description");
			assert.ok(final.updatedAt > p.updatedAt);
			return { statuses: responses.map((r) => r.status), winnerOnlyPatch: true };
		});

		// Deterministic locally generated image, no files/catalogue/seed input.
		const pixels = Buffer.alloc(512 * 512 * 3);
		let state = 123456789;
		for (let i = 0; i < pixels.length; i++) {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
			pixels[i] = state >>> 24;
		}
		const png = await sharp(pixels, { raw: { width: 512, height: 512, channels: 3 } }).png().toBuffer();
		const webp = await sharp(png).webp({ lossless: true }).toBuffer();
		await check("GridFS exact synthetic image bytes and internal indexes", async () => {
			const imageId = await images.saveProductImage(webp, { e0RunId: runId });
			assert.deepEqual(await bytes(imageId), webp);
			assert.ok(await db.collection("productImages.chunks").countDocuments({ files_id: imageId }) > 1);
			const response = await fetch(`${origin}/image/${imageId}`, {
				headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000)
			});
			assert.equal(response.status, 200);
			assert.deepEqual(Buffer.from(await response.arrayBuffer()), webp);
			const missing = new mongoose.Types.ObjectId();
			assert.equal((await fetch(`${origin}/image/${missing}`, {
				headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000)
			})).status, 404);
			assert.equal(await images.associateProductImage(ownId("ABSENT"), "", "not-linked"), false);
			return {
				bytes: webp.length,
				filesIndexes: (await db.collection("productImages.files").listIndexes().toArray()).map((i) => i.name),
				chunksIndexes: (await db.collection("productImages.chunks").listIndexes().toArray()).map((i) => i.name)
			};
		});

		await check("GridFS concurrent HTTP uploads / association CAS / loser cleanup preserves winner", async () => {
			const p = await fixture("UPLOAD-RACE");
			const processed = await processProductImage(png);
			const previousIds = new Set(fileIds.keys());
			const responses = await casRace(p.id, () => Promise.all([upload(p, png), upload(p, png)]));
			assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
			const winner = responses.find((r) => r.status === 201);
			const winnerId = new mongoose.Types.ObjectId(winner.body.imageId);
			const final = await read(p.id);
			assert.equal(final.imagen, winner.body.product.imagen);
			assert.deepEqual(await bytes(winnerId), processed.buffer);
			assert.equal(await db.collection("productImages.files").countDocuments({ "metadata.productId": p.id }), 2);
			assert.ok(await db.collection("productImages.chunks").countDocuments({ files_id: winnerId }) > 0);
			const raceIds = [...fileIds.keys()].filter((id) => !previousIds.has(id));
			assert.equal(raceIds.length, 2);
			const loserId = fileIds.get(raceIds.find((id) => id !== String(winnerId)));
			assert.equal(await db.collection("productImages.files").countDocuments({ _id: loserId, "metadata.e0Lifecycle.state": "protected" }), 1);
			assert.ok(await db.collection("productImages.chunks").countDocuments({ files_id: loserId }) > 0);
			// A corrupt subsequent upload must preserve the already linked winner too.
			assert.equal((await upload(final, Buffer.from("not an image"))).status, 422);
			assert.equal((await read(p.id)).imagen, final.imagen);
			assert.deepEqual(await bytes(winnerId), processed.buffer);
			return { statuses: responses.map((r) => r.status), linkedFiles: 1, conservativeRetainedFiles: 2, winnerBytesExact: true };
		});

		await check("deleteProductById real update pipeline / future, absent, null, corrupt references", async () => {
			const target = await fixture("DELETE-TARGET");
			const references = [];
			for (const value of [new Date("2099-01-01T00:00:00Z"), null, "corrupt", undefined]) {
				const ref = await fixture(`REFERENCE-${serial++}`, {
					relatedProductIds: [target.id, ownId("OTHER")], updatedAt: value ?? null
				});
				if (value === undefined) await collection.updateOne({ id: ref.id }, { $unset: { updatedAt: "" } });
				references.push({ ...ref, updatedAt: value });
			}
			assert.equal((await store.deleteProductById(target.id, target.updatedAt)).id, target.id);
			assert.equal(await read(target.id), null);
			assert.equal(await store.deleteProductById(ownId("ABSENT"), null), null);
			for (const ref of references) {
				const final = await read(ref.id);
				assert.deepEqual(final.relatedProductIds, [ownId("OTHER")]);
				assert.ok(final.updatedAt instanceof Date);
				if (ref.updatedAt instanceof Date) assert.ok(final.updatedAt > ref.updatedAt);
			}
			return { referencingDocuments: references.length, transactional: false };
		});

		await check("Referenced image deletion blocked, shared bytes recoverable", async () => {
			const originalId = await images.saveProductImage(webp, { e0RunId: runId });
			await fixture("ORIGINAL-DELETE-REGRESSION", { imagen: `${origin}/api/product-images/${originalId}` });
			await assert.rejects(images.deleteUnlinkedImage(originalId), { code: "IMAGE_REFERENCED" });
			assert.deepEqual(await bytes(originalId), webp);
			const imageId = await images.saveProductImage(webp, { e0RunId: runId });
			const p = await fixture("DELETE-LINKED");
			const other = await fixture("SHARED");
			const url = `${origin}/api/product-images/${imageId}`;
			assert.equal(await images.associateProductImage(p.id, p.imagen, url), true);
			assert.equal(await images.associateProductImage(other.id, other.imagen, url), true);
			assert.equal(await db.collection("productImages.files").countDocuments({ _id: imageId }), 1);
			assert.ok(await db.collection("productImages.chunks").countDocuments({ files_id: imageId }) > 0);
			await assert.rejects(images.deleteUnlinkedImage(imageId), { status: 409 });
			const fileCount = await db.collection("productImages.files").countDocuments({ _id: imageId });
			const chunkCount = await db.collection("productImages.chunks").countDocuments({ files_id: imageId });
			assert.equal((await read(p.id)).imagen, url);
			assert.equal(fileCount, 1);
			assert.ok(chunkCount > 0);
			const danglingResponse = await fetch(`${origin}/image/${imageId}`, {
				headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000)
			});
			assert.equal(danglingResponse.status, 200);
			assert.deepEqual(Buffer.from(await danglingResponse.arrayBuffer()), webp);
			await store.deleteProductById(p.id, (await read(p.id)).updatedAt);
			await assert.rejects(images.deleteUnlinkedImage(imageId), { status: 409 });
			assert.deepEqual(await bytes(imageId), webp);
			return { deletionBlocked: true, sharedReferencePreserved: true, bytesExact: true };
		});

		await check("Private image cleanup, double deletion and missing/legacy reference guards", async () => {
			const imageId = await images.saveProductImage(webp, { e0RunId: runId });
			const gate = barrier(2, 10000);
			const results = await withMethod(mongoose.mongo.Collection.prototype, "findOneAndUpdate", (original) =>
				async function (filter, ...args) {
					if (this.collectionName === "productImages.files" && filter._id?.equals(imageId)) await gate.arrive();
					return original.call(this, filter, ...args);
				}, () => Promise.allSettled([images.deleteUnlinkedImage(imageId), images.deleteUnlinkedImage(imageId)]));
			assert.equal(gate.arrivals, 2);
			assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
			assert.equal(results.find((result) => result.status === "rejected").reason.status, 409);
			assert.equal(await db.collection("productImages.files").countDocuments({ _id: imageId }), 0);
			assert.equal(await db.collection("productImages.chunks").countDocuments({ files_id: imageId }), 0);
			const p = await fixture("MISSING-IMAGE");
			const missingUrl = `${origin}/api/product-images/${new mongoose.Types.ObjectId()}`;
			assert.equal((await put(p.id, { imagen: missingUrl, _expectedUpdatedAt: p.updatedAt })).status, 409);
			assert.equal((await read(p.id)).imagen, p.imagen);
			const legacyId = await images.saveProductImage(webp, { e0RunId: runId });
			await db.collection("productImages.files").updateOne({ _id: legacyId }, { $unset: { "metadata.e0Lifecycle": "" } });
			await assert.rejects(images.deleteUnlinkedImage(legacyId), { status: 409 });
			assert.deepEqual(await bytes(legacyId), webp);
			return { doubleDeletionWinners: 1, legacyRetained: true };
		});

		for (const firstOperation of ["protect", "delete"]) {
			await check(`Image association versus deletion: ${firstOperation} wins lifecycle CAS`, async () => {
				const imageId = await images.saveProductImage(webp, { e0RunId: runId });
				const p = await fixture(`LIFECYCLE-${firstOperation}`);
				const url = `${origin}/api/product-images/${imageId}`;
				let release;
				const gate = barrier(2, 10000);
				const firstDone = new Promise((resolve) => { release = resolve; });
				const results = await withMethod(mongoose.mongo.Collection.prototype, "findOneAndUpdate", (original) =>
					async function (filter, ...args) {
						if (this.collectionName !== "productImages.files" || !filter._id?.equals(imageId)) {
							return original.call(this, filter, ...args);
						}
						await gate.arrive();
						const kind = filter["metadata.e0Lifecycle.state"] === "private" ? "delete" : "protect";
						if (kind !== firstOperation) await Promise.race([firstDone, new Promise((_, reject) => {
							const timer = setTimeout(() => reject(new Error("Lifecycle barrier timeout")), 10000);
							timer.unref();
						})]);
						try { return await original.call(this, filter, ...args); }
						finally { if (kind === firstOperation) release(); }
					},
				() => Promise.allSettled([
					images.associateProductImage(p.id, p.imagen, url),
					images.deleteUnlinkedImage(imageId)
				]));
				assert.equal(gate.arrivals, 2);
				const persisted = await read(p.id);
				if (firstOperation === "protect") {
					assert.equal(results[0].value, true);
					assert.equal(results[1].status, "rejected");
					assert.equal(persisted.imagen, url);
					assert.deepEqual(await bytes(imageId), webp);
				} else {
					assert.equal(results[1].status, "fulfilled");
					assert.equal(results[0].value, false);
					assert.equal(persisted.imagen, p.imagen);
				}
				return { noBrokenReference: true };
			});
		}

		await check("Failed chunk cleanup keeps deletion marker and blocks new references", async () => {
			const imageId = await images.saveProductImage(webp, { e0RunId: runId });
			await withMethod(mongoose.mongo.Collection.prototype, "deleteMany", (original) => async function (filter, ...args) {
				if (this.collectionName === "productImages.chunks" && filter.files_id?.equals(imageId)) throw new Error("Injected cleanup failure");
				return original.call(this, filter, ...args);
			}, () => assert.rejects(images.deleteUnlinkedImage(imageId), /Injected cleanup failure/));
			assert.equal((await db.collection("productImages.files").findOne({ _id: imageId })).metadata.e0Lifecycle.state, "deleting");
			const p = await fixture("FAILED-CLEANUP");
			assert.equal(await images.associateProductImage(p.id, p.imagen, `${origin}/api/product-images/${imageId}`), false);
			assert.equal((await read(p.id)).imagen, p.imagen);
			assert.deepEqual(await bytes(imageId), webp);
			return { fileRetained: true, publicationBlocked: true };
		});

		await check("Failure finalizing GridFS deletion leaves a nonpublishable marker", async () => {
			const imageId = await images.saveProductImage(webp, { e0RunId: runId });
			await withMethod(mongoose.mongo.Collection.prototype, "deleteOne", (original) => async function (filter, ...args) {
				if (this.collectionName === "productImages.files" && filter._id?.equals(imageId)) throw new Error("Injected file-finalization failure");
				return original.call(this, filter, ...args);
			}, () => assert.rejects(images.deleteUnlinkedImage(imageId), /Injected file-finalization failure/));
			assert.equal(await db.collection("productImages.chunks").countDocuments({ files_id: imageId }), 0);
			assert.equal((await db.collection("productImages.files").findOne({ _id: imageId })).metadata.e0Lifecycle.state, "deleting");
			const p = await fixture("PARTIAL-CLEANUP");
			assert.equal(await images.associateProductImage(p.id, p.imagen, `${origin}/api/product-images/${imageId}`), false);
			assert.equal((await read(p.id)).imagen, p.imagen);
			return { incompleteCleanupVisible: true, brokenPublicationPrevented: true };
		});

		await check("Missing code index blocks creation without writes; prepare local unique index only", async () => {
			const blocked = await imported([row("NO-INDEX")]);
			assert.equal(blocked.status, 207);
			assert.equal(blocked.body.rows[0].code, "CODE_INDEX_REQUIRED");
			assert.equal(await collection.countDocuments({ codigo: ownId("NO-INDEX") }), 0);
			const first = await fixture("HISTORY-DUP-1", { codigo: ownId("HISTORY-DUP") });
			const second = await fixture("HISTORY-DUP-2", { codigo: ownId("HISTORY-DUP") });
			await assert.rejects(collection.createIndex({ codigo: 1 }, { unique: true, name: "e0_codigo_unique", collation: { locale: "simple" } }), { code: 11000 });
			assert.equal(await collection.countDocuments({ codigo: ownId("HISTORY-DUP") }), 2);
			// Fixtures belong to this run; a commercial reconciliation must never do this automatically.
			await collection.deleteMany({ id: { $in: [first.id, second.id] } });
			await collection.createIndex({ codigo: 1 }, { unique: true, name: "e0_codigo_unique", collation: { locale: "simple" } });
		});

		await checkRejectedRecovery();

		await check("Historical noncanonical code blocks new writes until authorized reconciliation", async () => {
			const invalid = [`${prefix}legacy`, `${prefix}TRAILING\n`, [`${prefix}ARRAY`]];
			for (let i = 0; i < invalid.length; i += 1) {
				const legacy = await fixture(`NONCANONICAL-${i}`, { codigo: invalid[i] });
				try {
					const result = await imported([row(`NONCANONICAL-BLOCK-${i}`)]);
					assert.equal(result.body.rows[0].code, "CODE_HISTORY_REVIEW_REQUIRED");
					assert.equal(await collection.countDocuments({ codigo: ownId(`NONCANONICAL-BLOCK-${i}`) }), 0);
				} finally {
					await collection.deleteOne({ id: legacy.id });
				}
			}
		});

		await check("Concurrent import same code: unique index permits only one insertion", async () => {
			const duplicate = row("DUPLICATE-RACE");
			const gate = barrier(2, 10000);
			const responses = await withMethod(model, "bulkWrite", (original) => async function (operations, options) {
				assert.equal(operations.length, 1);
				assert.equal(operations[0].insertOne.document.codigo, duplicate.codigo);
				await gate.arrive(); // both existing-code reads completed; no bulk has run yet
				return original.call(this, operations, options);
			}, () => Promise.all([imported([duplicate]), imported([duplicate])]));
			assert.equal(gate.arrivals, 2);
			assert.deepEqual(responses.map((r) => r.status).sort(), [200, 207]);
			assert.deepEqual(responses.map((r) => r.body.created).sort(), [0, 1]);
			assert.equal(responses.find((r) => r.status === 207).body.rows[0].code, "DUPLICATE_CODE");
			const persisted = await collection.find({ codigo: duplicate.codigo }).toArray();
			assert.equal(persisted.length, 1);
			assert.ok(persisted.every((p) => ids.has(p.id)));
			return { apiStatuses: responses.map((r) => r.status), persistedCount: persisted.length, duplicateRejected: true };
		});

		await check("Concurrent POSTs canonical code / distinct codes / conflicting PUT", async () => {
			const payload = { ...row("POST-CODE"), imagen: "/synthetic.webp" };
			const posts = await Promise.all(Array.from({ length: 5 }, (_, i) => json("POST", "/products", {
				...payload, codigo: i % 2 ? payload.codigo.toLowerCase() : ` ${payload.codigo} `
			})));
			assert.equal(posts.filter((r) => r.status === 201).length, 1);
			assert.equal(posts.filter((r) => r.status === 409).length, 4);
			assert.equal(await collection.countDocuments({ codigo: payload.codigo }), 1);
			const different = await Promise.all(["A", "B", "C"].map((label) => json("POST", "/products", {
				...payload, codigo: ownId(`DIFFERENT-${label}`)
			})));
			assert.ok(different.every((r) => r.status === 201));
			const p = await fixture("CODE-EDIT");
			assert.equal((await put(p.id, { codigo: payload.codigo, _expectedUpdatedAt: p.updatedAt })).status, 409);
			assert.equal((await read(p.id)).codigo, p.codigo);
			assert.equal((await json("POST", "/products", { ...payload, codigo: "A/B" })).status, 400);
			return { simultaneous: 5, created: 1, conflicts: 4, differentCreated: 3 };
		});

		await check("POST and PUT image references participate; changing reference cannot delete published image", async () => {
			const oldId = await images.saveProductImage(webp, { e0RunId: runId });
			const oldUrl = `${origin}/api/product-images/${oldId}`;
			const created = await json("POST", "/products", { ...row("POST-IMAGE"), imagen: oldUrl });
			assert.equal(created.status, 201);
			await assert.rejects(images.deleteUnlinkedImage(oldId), { status: 409 });
			const newId = await images.saveProductImage(webp, { e0RunId: runId });
			const newUrl = `${origin}/api/product-images/${newId}/`;
			const outcomes = await Promise.allSettled([
				put(created.body.id, { imagen: newUrl, _expectedUpdatedAt: created.body.updatedAt }),
				images.deleteUnlinkedImage(oldId)
			]);
			assert.equal(outcomes[0].value.status, 200);
			assert.equal(outcomes[1].status, "rejected");
			assert.equal((await read(created.body.id)).imagen, newUrl);
			await assert.rejects(images.deleteUnlinkedImage(newId), { status: 409 });
			assert.deepEqual(await bytes(newId), webp);
			assert.deepEqual(await bytes(oldId), webp);
			return { postProtected: true, putProtected: true, permanentRetention: true };
		});

		await check("Partial synthetic import valid/invalid / stock null zero omit / protected fields / no deletion", async () => {
			const existing = await fixture("IMPORT-EXISTING", { stock: 9 });
			const untouched = await fixture("IMPORT-ABSENT");
			const response = await imported([
				row("IMPORT-NEW"), row("IMPORT-BAD", { stock: "2 units", rowNumber: 22 }),
				{ codigo: existing.codigo, nombre: "imported", stock: null, precioCosto: 999,
					imagen: "not-permitted", estado: "sin stock", descripcion: "not-permitted", variantes: [] }
			]);
			assert.equal(response.status, 207);
			assert.equal(response.body.created, 1);
			assert.equal(response.body.updated, 1);
			assert.equal(response.body.errors.length, 1);
			assert.equal(response.body.errors[0].row, 22);
			assert.equal(await collection.countDocuments({ codigo: ownId("IMPORT-BAD") }), 0);
			const fresh = await collection.findOne({ codigo: ownId("IMPORT-NEW") });
			assert.equal(fresh.stock, null);
			for (const stock of [null, 0]) {
				const newRow = row(`IMPORT-STOCK-${String(stock).toUpperCase()}`, { stock });
				assert.equal((await imported([newRow])).status, 200);
				const persisted = await collection.findOne({ codigo: newRow.codigo });
				assert.ok(persisted, "New synthetic stock row must exist");
				assert.equal(persisted.stock, stock);
			}
			const final = await read(existing.id);
			assert.equal(final.stock, 9);
			for (const field of ["precioCosto", "imagen", "estado", "descripcion", "variantes", "relatedProductIds"]) {
				assert.deepEqual(final[field], existing[field]);
			}
			assert.equal((await imported([{ codigo: existing.codigo, stock: 0 }])).status, 200);
			assert.equal((await read(existing.id)).stock, 0);
			for (const stock of [undefined, null, "", "   "]) {
				assert.equal((await imported([{ codigo: existing.codigo, nombre: "preserve-zero", stock }])).status, 200);
				assert.equal((await read(existing.id)).stock, 0);
			}
			assert.ok(await read(untouched.id));
			return { created: response.body.created, updated: response.body.updated, rejectedRows: [22], stockZeroPreserved: true };
		});

		await check("Second-row real 11000 / per-row receipt / replay and selective retry", async () => {
			const first = await fixture("PARTIAL-FIRST", { stock: 7 });
			const anchor = await fixture("PARTIAL-ANCHOR");
			const second = row("PARTIAL-SECOND");
			const payload = [{ codigo: first.codigo, nombre: "first-applied", stock: 0 }, second];
			const batchId = `E0-${runId}-partial`;
			let injected = 0;
			let realFailureCode;
			const response = await withMethod(model, "bulkWrite", (original) => async function (operations, options) {
				assert.equal(options.ordered, true);
				assert.equal(operations.length, 1);
				// Only synthetic row two changes; the original real bulk hits Mongo's
				// existing implicit _id uniqueness constraint, AFTER row one commits.
				if (operations[0].insertOne?.document.codigo === second.codigo) {
					operations[0].insertOne.document._id = anchor._id;
					injected++;
				}
				try {
					return await original.call(this, operations, options);
				} catch (error) {
					realFailureCode = error.code;
					throw error;
				}
			}, () => imported(payload, { batchId }));
			assert.equal(injected, 1);
			assert.equal(realFailureCode, 11000);
			assert.equal(response.status, 207);
			assert.equal(response.body.updated, 1);
			assert.equal(response.body.rows[0].status, "updated");
			assert.equal(response.body.rows[1].status, "failed");
			const afterFirst = await read(first.id);
			const afterSecond = await collection.findOne({ codigo: second.codigo });
			assert.equal(afterFirst.nombre, "first-applied");
			assert.equal(afterFirst.stock, 0);
			assert.ok(afterFirst.updatedAt > first.updatedAt);
			assert.equal(afterSecond, null);
			assert.equal((await read(anchor.id)).codigo, anchor.codigo);
			// No automatic repair. Operator-style explicit retry, without injection.
			const replay = await imported(payload, { batchId });
			assert.equal(replay.status, 207);
			assert.equal((await read(first.id)).updatedAt.getTime(), afterFirst.updatedAt.getTime());
			const retry = await imported(payload, { batchId, retryRows: [1] });
			assert.equal(retry.status, 200);
			assert.equal(retry.body.created, 1);
			assert.equal(retry.body.updated, 1);
			const retryFirst = await read(first.id);
			const retrySecond = await collection.findOne({ codigo: second.codigo });
			assert.equal(retryFirst.updatedAt.getTime(), afterFirst.updatedAt.getTime());
			assert.ok(retrySecond);
			assert.equal(retrySecond.stock, null);
			return { partialStatus: response.status, mongoErrorCode: realFailureCode, confirmedNotRepeated: true, selectiveRetryStatus: retry.status };
		});

		await check("Import CAS conflict and explicit unchanged retry preserve concurrent changes", async () => {
			const product = await fixture("IMPORT-CAS", { familiaSlug: "synthetic", subfamiliaSlug: "synthetic" });
			const payload = [row("IMPORT-CAS", { stock: 17 })];
			const batchId = `E0-${runId}-import-cas`;
			const start = barrier(2, 10000);
			const written = barrier(2, 10000);
			const [result] = await withMethod(model, "bulkWrite", (original) => async function (...args) {
				await start.arrive();
				await written.arrive();
				return original.apply(this, args);
			}, () => Promise.all([
				imported(payload, { batchId }),
				(async () => {
					await start.arrive();
					await collection.updateOne({ id: product.id }, { $set: {
						stock: 17, descripcion: "concurrent change", updatedAt: new Date(initialDate.getTime() + 50)
					} });
					await written.arrive();
				})()
			]));
			assert.equal(start.arrivals, 2);
			assert.equal(result.status, 207);
			assert.equal(result.body.rows[0].code, "VERSION_CONFLICT");
			const before = await read(product.id);
			const retry = await imported(payload, { batchId, retryRows: [0] });
			assert.equal(retry.status, 200);
			assert.equal(retry.body.unchanged, 1);
			assert.equal(retry.body.rows[0].code, undefined);
			assert.equal(retry.body.rows[0].message, undefined);
			assert.equal((await read(product.id)).updatedAt.getTime(), before.updatedAt.getTime());
			assert.equal((await read(product.id)).descripcion, "concurrent change");
			return { conflictStatus: 207, explicitRetryUnchanged: true, concurrentFieldPreserved: true };
		});

		await check("Stable batch identity, concurrent replay, content collision and unknown write blocked", async () => {
			assert.equal((await json("POST", "/import", { products: [row("NO-BATCH")] })).status, 428);
			const payload = [row("REPLAY")];
			const batchId = `E0-${runId}-replay`;
			await Promise.all([imported(payload, { batchId }), imported(payload, { batchId })]);
			const before = await collection.findOne({ codigo: payload[0].codigo });
			assert.ok(before);
			const replay = await imported(payload, { batchId });
			assert.equal(replay.body.created, 1);
			assert.equal(await collection.countDocuments({ codigo: payload[0].codigo }), 1);
			assert.equal((await collection.findOne({ codigo: payload[0].codigo })).updatedAt.getTime(), before.updatedAt.getTime());
			assert.equal((await imported([row("OTHER-CONTENT")], { batchId })).status, 409);

			const unknownBatch = `E0-${runId}-unknown`;
			const unknownRows = [row("ACK-LOST")];
			const unknown = await withMethod(model, "bulkWrite", (original) => async function (...args) {
				await original.apply(this, args);
				throw Object.assign(new Error("Injected lost acknowledgement with unproven duplicate code"), { code: 11000 });
			}, () => imported(unknownRows, { batchId: unknownBatch }));
			assert.equal(unknown.status, 207);
			assert.equal(unknown.body.rows[0].status, "unknown");
			assert.ok(await collection.findOne({ codigo: unknownRows[0].codigo }));
			const retry = await imported(unknownRows, { batchId: unknownBatch, retryRows: [0] });
			assert.equal(retry.body.rows[0].status, "unknown");
			assert.equal(retry.body.rows[0].attempts, 1);
			assert.equal(await collection.countDocuments({ codigo: unknownRows[0].codigo }), 1);
			return { missingBatchStatus: 428, unknownRetryBlocked: true, replayWithoutSideEffect: true };
		});

		await check("Receipt confirmation failure never converts a committed write into retryable failure", async () => {
			const batchId = `E0-${runId}-receipt-failure`;
			const payload = [row("RECEIPT-FAILURE")];
			const result = await withMethod(mongoose.mongo.Collection.prototype, "updateOne", (original) => async function (filter, update, ...args) {
				const value = update.$set?.["rows.0"];
				if (this.collectionName === "productImportReceipts" && filter._id === batchId && value?.status === "created") {
					throw new Error("Injected receipt acknowledgement failure");
				}
				return original.call(this, filter, update, ...args);
			}, () => imported(payload, { batchId }));
			assert.equal(result.status, 207);
			assert.equal(result.body.rows[0].status, "unknown");
			assert.equal(result.body.processing, true);
			assert.ok(await collection.findOne({ codigo: payload[0].codigo }));
			const retry = await imported(payload, { batchId, retryRows: [0] });
			assert.equal(retry.body.rows[0].attempts, 1);
			const receipt = await json("GET", `/import/${batchId}`);
			assert.equal(receipt.body.unknown, 1);
			const script = `
				import assert from "node:assert/strict";
				const support = await import(${JSON.stringify(new URL("./e0-support.mjs", import.meta.url).href)});
				const config = JSON.parse(process.env.E0_INTEGRATION_CONFIG);
				support.verifyIntegrationEnvironment(process.env, config.port, config.runId);
				await support.verifyOwner(config.root, config.owner);
				const { default: mongoose } = await import(${JSON.stringify(new URL("../node_modules/mongoose/index.js", import.meta.url).href)});
				support.verifyDisconnected(mongoose.connection);
				mongoose.set("autoIndex", false); mongoose.set("autoCreate", false);
				const imports = await import(${JSON.stringify(new URL("../data/product-imports.store.js", import.meta.url).href)});
				const [batchId, products] = JSON.parse(process.argv[1]);
				try {
					const before = await imports.getProductImport(batchId);
					const model = mongoose.model("Product");
					const product = await model.findOne({ codigo: products[0].codigo }).lean();
					model.bulkWrite = () => { throw new Error("Fresh worker must not replay unknown writes"); };
					const result = await imports.runProductImport({ batchId, products, retryRows: [0] }, (row) => row);
					assert.equal(before.processing, true);
					assert.equal(result.report.processing, true);
					assert.equal(result.report.unknown, 1);
					assert.equal(result.report.rows[0].attempts, 1);
					assert.equal((await model.findOne({ id: product.id }).lean()).updatedAt.getTime(), product.updatedAt.getTime());
					console.log("fresh-worker-replay-blocked");
				} finally { await mongoose.disconnect(); }
			`;
			const child = await promisify(execFile)(process.execPath,
				["--input-type=module", "--eval", script, JSON.stringify([batchId, payload])], {
					timeout: 20000, env: {
						...cleanEnvironment(), MONGO_URI: process.env.MONGO_URI, MONGODB_URI: process.env.MONGODB_URI,
						MONGO_DB_NAME: process.env.MONGO_DB_NAME, VGV_E0_LOCAL_RUN: runId,
						E0_INTEGRATION_CONFIG: process.env.E0_INTEGRATION_CONFIG
					}
				});
			assert.equal(child.stdout.trim(), "fresh-worker-replay-blocked");
			return { confirmationGapBlocked: true, freshWorkerReplayBlocked: true, exactlyOnceNotAssumed: true };
		});

		await check("Product unique index is explicit and local", async () => {
			const indexes = await collection.listIndexes().toArray();
			assert.ok(indexes.some((index) => index.name === "e0_codigo_unique" && index.unique));
			// Mongo omits `unique` for the implicit _id index; it is still unique.
			return { indexes: indexes.map(({ name, key, unique }) => ({
				name, key, unique: name === "_id_" || Boolean(unique), implicit: name === "_id_"
			})) };
		});
	}

	async function cleanup() {
		await verifyOwner(config.root, config.owner);
		if (server) {
			const closed = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
			server.closeAllConnections();
			await closed;
		}
		model.bulkWrite = realBulk;
		model.create = realCreate;
		bucketPrototype.openUploadStream = realUpload;
		// Fail closed on foreign resources. Do not drop collections or databases.
		const documents = await collection.find({}).toArray();
		for (const document of documents) {
			assert.ok(ids.has(document.id));
			assert.ok(document.codigo.startsWith(prefix));
		}
		const files = await db.collection("productImages.files").find({}).toArray();
		for (const file of files) {
			assert.equal(file.metadata.e0RunId, runId);
			assert.ok(fileIds.has(String(file._id)));
		}
		const chunks = await db.collection("productImages.chunks").find({}, { projection: { files_id: 1 } }).toArray();
		for (const chunk of chunks) assert.ok(fileIds.has(String(chunk.files_id)));
		const receipts = db.collection("productImportReceipts");
		for (const receipt of await receipts.find({}).toArray()) assert.ok(batchIds.has(receipt._id));
		await db.collection("productImages.chunks").deleteMany({ files_id: { $in: [...fileIds.values()] } });
		await db.collection("productImages.files").deleteMany({ _id: { $in: [...fileIds.values()] }, "metadata.e0RunId": runId });
		await collection.deleteMany({ id: { $in: [...ids] } });
		await receipts.deleteMany({ _id: { $in: [...batchIds] } });
		assert.equal(await collection.countDocuments({}), 0);
		assert.equal(await db.collection("productImages.files").countDocuments({}), 0);
		assert.equal(await db.collection("productImages.chunks").countDocuments({}), 0);
	}
	return { run, cleanup };
}
