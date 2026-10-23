import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import {
	buildCreatePayload,
	buildImportPayload,
	buildUpdatePayload,
	bulkImportProductsController,
	getProducts,
	updateProductController
} from "../controllers/products.controller.js";
import {
	bulkUpsertProductsByCode,
	deleteProductById,
	disconnectProductsDatabase,
	getProductById,
	getProductsByIds,
	listProducts,
	syncSeedProducts,
	updateProductById
} from "../data/products.store.js";
import { associateProductImage } from "../data/product-images.store.js";
import { parseExcelNumber } from "../../catalogo-vgv/src/lib/utils/import-number.js";

const ProductModel = mongoose.models.Product;
const methodNames = [
	"find",
	"findOne",
	"updateOne",
	"deleteMany",
	"create",
	"bulkWrite",
	"findOneAndUpdate",
	"findOneAndDelete",
	"updateMany",
	"countDocuments"
];

function query(value) {
	return {
		sort() {
			return this;
		},
		lean: async () => value
	};
}

async function withMockedDatabase(run, { connectError } = {}) {
	const originalConnect = mongoose.connect;
	const originalIndexes = ProductModel.collection.indexes;
	const originalNativeFind = ProductModel.collection.findOne;
	const originalDb = mongoose.connection.db;
	ProductModel.collection.indexes = async () => [{ name: "e0_codigo_unique", key: { codigo: 1 }, unique: true }];
	ProductModel.collection.findOne = async () => null;
	mongoose.connection.db = { collection: () => ({
		findOneAndUpdate: async () => ({ _id: "mock-protected-image" }),
		findOne: async () => null
	}) };
	const originalMethods = Object.fromEntries(methodNames.map((name) => [name, ProductModel[name]]));
	let connectCalls = 0;
	mongoose.connect = async () => {
		connectCalls += 1;
		if (connectError) throw connectError;
		return mongoose.connection;
	};

	try {
		await run({
			connectCalls: () => connectCalls,
			restoreMethods() {
				for (const name of methodNames) ProductModel[name] = originalMethods[name];
			}
		});
	} finally {
		mongoose.connection.db = originalDb;
		ProductModel.collection.indexes = originalIndexes;
		ProductModel.collection.findOne = originalNativeFind;
		mongoose.connect = originalConnect;
		for (const name of methodNames) ProductModel[name] = originalMethods[name];
		await disconnectProductsDatabase();
	}
}

test("lecturas vacías no cuentan, insertan ni sincronizan productos de ejemplo", async () => {
	await withMockedDatabase(async () => {
		let writes = 0;
		ProductModel.find = () => query([]);
		ProductModel.findOne = () => query(null);
		for (const name of ["updateOne", "deleteMany", "create", "bulkWrite", "countDocuments"]) {
			ProductModel[name] = async () => {
				writes += 1;
				return name === "countDocuments" ? 0 : undefined;
			};
		}

		assert.deepEqual(await listProducts(), []);
		assert.equal(await getProductById("17"), null);
		assert.deepEqual(await getProductsByIds(["17"]), []);
		assert.equal(writes, 0);
	});
});

test("error de conexión produce HTTP 500 controlado, no respuesta ficticia exitosa", async () => {
	const originalError = console.error;
	console.error = () => {};
	try {
		await withMockedDatabase(async () => {
			const response = {
				statusCode: 200,
				body: null,
				status(code) {
					this.statusCode = code;
					return this;
				},
				json(body) {
					this.body = body;
					return this;
				}
			};
			await getProducts({}, response);
			assert.equal(response.statusCode, 500);
			assert.deepEqual(response.body, { error: "No se pudieron obtener los productos." });
		}, { connectError: new Error("offline test database") });
	} finally {
		console.error = originalError;
	}
});

test("sincronización seed solo inserta faltantes y rechaza eliminación antes de conectar", async () => {
	await withMockedDatabase(async ({ connectCalls }) => {
		await assert.rejects(syncSeedProducts({ removeMissing: true }), /eliminación.*deshabilitada/i);
		assert.equal(connectCalls(), 0);

		const operations = [];
		let deletions = 0;
		ProductModel.updateOne = async (...args) => operations.push(args);
		ProductModel.deleteMany = async () => {
			deletions += 1;
		};
		ProductModel.find = () => query([]);
		await syncSeedProducts();

		assert.ok(operations.length > 0);
		assert.ok(operations.every(([, update, options]) =>
			Boolean(update.$setOnInsert) && !update.$set && options.upsert === true &&
			options.timestamps === false && update.$setOnInsert.updatedAt instanceof Date
		));
		assert.equal(deletions, 0);
	});
});

test("un update parcial no recompone el documento ni altera campos ajenos", async () => {
	await withMockedDatabase(async () => {
		let call;
		const updatedAt = new Date("2026-10-23T12:00:00.000Z");
		ProductModel.findOneAndUpdate = (...args) => {
			call = args;
			return query({
				id: "17",
				codigo: "SKU-17",
				nombre: "Nombre editado",
				updatedAt,
				imagen: "/api/product-images/existing",
				stock: null,
				estado: "disponible",
				variantes: [{ sku: "VAR-OLD", medida: "", customField: "preserved" }],
				customField: "not overwritten"
			});
		};

		const saved = await updateProductById("17", { nombre: "Nombre editado" }, updatedAt);
		assert.deepEqual(call[0], { id: "17", updatedAt });
		assert.deepEqual(call[1].$set, {
			nombre: "Nombre editado",
			updatedAt: call[1].$set.updatedAt
		});
		assert.ok(call[1].$set.updatedAt instanceof Date);
		assert.ok(call[1].$set.updatedAt.getTime() > updatedAt.getTime());
		assert.equal(call[2].timestamps, false);
		assert.equal(saved.id, "17");
		assert.equal(saved.codigo, "SKU-17");
		assert.equal(saved.imagen, "/api/product-images/existing");
		assert.equal(saved.stock, null);
		assert.deepEqual(saved.variantes, [{ sku: "VAR-OLD", medida: "", customField: "preserved" }]);
	});
});

test("dos ediciones con la misma versión solo permiten una escritura", async () => {
	await withMockedDatabase(async () => {
		const current = {
			id: "17",
			codigo: "SKU-17",
			nombre: "Producto",
			descripcion: "Inicial",
			imagen: "/images/keep.webp",
			updatedAt: new Date("2026-10-23T12:00:00.000Z")
		};
		ProductModel.findOneAndUpdate = (filter, update) => {
			if (current.updatedAt.getTime() !== filter.updatedAt.getTime()) return query(null);
			Object.assign(current, update.$set);
			return query({ ...current });
		};
		ProductModel.findOne = () => query(current);

		const results = await Promise.allSettled([
			updateProductById("17", { descripcion: "Edición A" }, new Date(current.updatedAt)),
			updateProductById("17", { descripcion: "Edición B" }, new Date("2026-10-23T12:00:00.000Z"))
		]);
		assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
		const rejected = results.find((result) => result.status === "rejected");
		assert.equal(rejected.reason.status, 409);
		assert.ok(["Edición A", "Edición B"].includes(current.descripcion));
		assert.ok(current.updatedAt.getTime() > Date.parse("2026-10-23T12:00:00.000Z"));
	});
});

test("documento legacy sin updatedAt acepta null explícito y asigna versión BSON Date", async () => {
	await withMockedDatabase(async () => {
		let call;
		ProductModel.findOneAndUpdate = (...args) => {
			call = args;
			return query({ id: "legacy", nombre: "Actualizado", imagen: "/img.webp", updatedAt: args[1].$set.updatedAt });
		};
		const result = await updateProductById("legacy", { nombre: "Actualizado" }, null);
		assert.deepEqual(call[0], { id: "legacy", updatedAt: null });
		assert.ok(call[1].$set.updatedAt instanceof Date);
		assert.equal(result.updatedAt.getTime(), call[1].$set.updatedAt.getTime());
	});
});

test("importación existente aplica solo los campos proporcionados y omite imagen administrada", async () => {
	await withMockedDatabase(async () => {
		const operations = [];
		let findCount = 0;
		let deletions = 0;
		ProductModel.deleteMany = async () => {
			deletions += 1;
		};
		ProductModel.find = (filter) => {
			findCount += 1;
			return query(findCount === 1
				? [{
					id: "17",
					codigo: "PIPE-20",
					updatedAt: new Date("2026-10-23T12:00:00.000Z")
				}]
				: [{
					id: "17",
					codigo: "PIPE-20",
					nombre: "Nombre importado",
					imagen: "/api/product-images/kept",
					stock: null,
					estado: "disponible",
					updatedAt: new Date("2026-10-23T12:01:00.000Z"),
					variantes: [{ sku: "ORIGINAL", medida: "20mm" }]
				}]);
		};
		ProductModel.bulkWrite = async (value) => {
			operations.push(...value);
			return { matchedCount: value.length };
		};

		const result = await bulkUpsertProductsByCode([{
			codigo: "PIPE-20",
			nombre: "Nombre importado",
			imagen: "/assets/images/producto-sin-imagen.svg",
			id: "NO-CAMBIAR", sku: "NO-CAMBIAR", precioCosto: 999,
			estado: "sin stock", variantes: [{ sku: "NO-CAMBIAR" }],
			descripcion: "No autorizado", relatedProductIds: ["other"]
		}]);

		assert.equal(result[0].created, false);
		assert.deepEqual(operations[0].updateOne.update.$set.nombre, "Nombre importado");
		assert.equal(operations[0].updateOne.filter.id, "17");
		assert.ok(operations[0].updateOne.update.$set.updatedAt.getTime() >
			Date.parse("2026-10-23T12:00:00.000Z"));
		assert.equal(operations[0].updateOne.timestamps, false);
		assert.equal(
			operations[0].updateOne.filter.updatedAt.toISOString(),
			"2026-10-23T12:00:00.000Z"
		);
		assert.equal("codigo" in operations[0].updateOne.update.$set, false);
		assert.equal("imagen" in operations[0].updateOne.update.$set, false);
		assert.equal("stock" in operations[0].updateOne.update.$set, false);
		assert.equal("variantes" in operations[0].updateOne.update.$set, false);
		assert.equal("precioCosto" in operations[0].updateOne.update.$set, false);
		assert.deepEqual(Object.keys(operations[0].updateOne.update.$set).sort(), ["nombre", "updatedAt"]);
		assert.equal(result[0].product.id, "17");
		assert.equal(result[0].product.codigo, "PIPE-20");
		assert.equal(result[0].product.stock, null);
		assert.equal(result[0].product.imagen, "/api/product-images/kept");
		assert.deepEqual(result[0].product.variantes, [{ sku: "ORIGINAL", medida: "20mm" }]);
		assert.equal(deletions, 0);
	});
});

test("importación aplica solo stock explícito y válido; stock desconocido no se convierte", async () => {
	await withMockedDatabase(async () => {
		const operations = [];
		ProductModel.find = (filter) => query(filter?.codigo
			? [{ id: "17", codigo: "PIPE-20", updatedAt: new Date("2026-10-23T12:00:00Z") }]
			: [{
				id: "17",
				codigo: "PIPE-20",
				stock: null,
				imagen: "/api/product-images/kept",
				variantes: [{ sku: "SKU-KEEP", medida: "20mm" }]
			}]);
		ProductModel.bulkWrite = async (value) => {
			operations.push(...value);
			return { matchedCount: value.filter((operation) => operation.updateOne).length };
		};

		await bulkUpsertProductsByCode([{ codigo: "PIPE-20", nombre: "Nuevo nombre", stock: 4 }]);
		assert.deepEqual(
			{ nombre: operations[0].updateOne.update.$set.nombre, stock: operations[0].updateOne.update.$set.stock },
			{ nombre: "Nuevo nombre", stock: 4 }
		);
		assert.equal(operations[0].updateOne.filter.updatedAt.toISOString(), "2026-10-23T12:00:00.000Z");
	});
});

test("importación existente sin campos autorizados no emite escritura", async () => {
	await withMockedDatabase(async () => {
		let writeCalls = 0;
		ProductModel.find = (filter) => query(filter?.codigo
			? [{ id: "17", codigo: "PIPE-20", updatedAt: new Date("2026-10-23T12:00:00Z") }]
			: [{ id: "17", codigo: "PIPE-20", nombre: "Conservar", stock: null }]);
		ProductModel.bulkWrite = async () => { writeCalls += 1; };

		const result = await bulkUpsertProductsByCode([{ codigo: "PIPE-20" }]);
		assert.equal(result[0].created, false);
		assert.equal(result[0].product.nombre, "Conservar");
		assert.equal(result[0].product.stock, null);
		assert.equal(writeCalls, 0);
	});
});

test("importación rechaza código ausente, duplicados y altas incompletas antes de escribir", async () => {
	await withMockedDatabase(async () => {
		let writes = 0;
		ProductModel.find = () => query([]);
		ProductModel.bulkWrite = async () => { writes += 1; };

		await assert.rejects(bulkUpsertProductsByCode([{ nombre: "Sin código" }]), /código único/);
		await assert.rejects(bulkUpsertProductsByCode([
			{ codigo: "DUP", nombre: "A" },
			{ codigo: "DUP", nombre: "B" }
		]), /código único/);
		const equivalent = [{ codigo: " dup code " }, { codigo: "DUP-CODE" }];
		await assert.rejects(bulkUpsertProductsByCode(equivalent), /código único/);
		assert.equal(equivalent[0].codigo, " dup code ");
		await assert.rejects(bulkUpsertProductsByCode([{ codigo: "NEW" }]), /nombre es obligatorio/);
		assert.equal(writes, 0);
	});
});

test("error durante bulk import informa que el lote puede haber aplicado filas previas", async () => {
	await withMockedDatabase(async () => {
		ProductModel.find = () => query([]);
		ProductModel.bulkWrite = async () => {
			throw Object.assign(new Error("write failed"), { writeErrors: [{ index: 1 }] });
		};
		await assert.rejects(
			bulkUpsertProductsByCode([{
				codigo: "NEW",
				nombre: "Nuevo",
				familia: "Tubería",
				subfamilia: "PVC",
				precioCosto: 12
			}]),
			(error) => {
				assert.equal(error.status, 500);
				assert.equal(error.partialPossible, true);
				assert.match(error.message, /algunas filas podrían haberse aplicado/i);
				return true;
			}
		);
	});
});

function responseRecorder() {
	return {
		statusCode: 200,
		body: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(body) {
			this.body = body;
			return this;
		}
	};
}

test("edición de descripción tras cambio de precio no sobrescribe el precio y devuelve conflicto", async () => {
	await withMockedDatabase(async () => {
		const original = {
			id: "17",
			codigo: "SKU-17",
			nombre: "Producto",
			descripcion: "Anterior",
			precioCosto: 200,
			imagen: "/api/product-images/keep",
			updatedAt: new Date("2026-10-23T12:01:00.000Z")
		};
		let updateFilter;
		let updateValue;
		ProductModel.findOne = () => query(original);
		ProductModel.findOneAndUpdate = (filter, update) => {
			updateFilter = filter;
			updateValue = update;
			return query(null);
		};
		const response = responseRecorder();

		await updateProductController({
			params: { id: "17" },
			body: {
				descripcion: "Editada por usuario A",
				_expectedUpdatedAt: "2026-10-23T12:00:00.000Z"
			}
		}, response);

		assert.equal(response.statusCode, 409);
		assert.equal(updateValue.$set.descripcion, "Editada por usuario A");
		assert.ok(updateValue.$set.updatedAt instanceof Date);
		assert.equal(updateFilter.updatedAt.toISOString(), "2026-10-23T12:00:00.000Z");
		assert.equal(updateValue.$set.precioCosto, undefined);
		assert.equal(original.precioCosto, 200);
		assert.equal(original.descripcion, "Anterior");
	});
});

test("versión obsoleta responde conflicto controlado y versión ausente es requerida", async () => {
	await withMockedDatabase(async () => {
		const original = {
			id: "17",
			codigo: "SKU-17",
			nombre: "Producto",
			descripcion: "Concurrente",
			imagen: "/images/keep.webp",
			updatedAt: new Date("2026-10-23T12:01:00.000Z")
		};
		ProductModel.findOne = () => query(original);
		ProductModel.findOneAndUpdate = () => query(null);
		const response = responseRecorder();

		await updateProductController({
			params: { id: "17" },
			body: {
				descripcion: "Valor obsoleto",
				_expectedUpdatedAt: "2026-10-23T12:00:00.000Z"
			}
		}, response);
		assert.equal(response.statusCode, 409);
		assert.match(response.body.error, /cambió desde que lo cargaste/);

		const missingVersion = responseRecorder();
		await updateProductController({ params: { id: "17" }, body: { descripcion: "sin versión" } }, missingVersion);
		assert.equal(missingVersion.statusCode, 428);
	});
});

test("PUT convierte ISO zonificado a Date y rechaza fechas locales o inválidas", async () => {
	await withMockedDatabase(async () => {
		let capturedFilter;
		const current = {
			id: "17",
			codigo: "SKU-17",
			nombre: "Producto",
			descripcion: "Actual",
			imagen: "/images/keep.webp",
			updatedAt: new Date("2026-10-23T10:00:00.000Z")
		};
		ProductModel.findOne = () => query(current);
		ProductModel.findOneAndUpdate = (filter) => {
			capturedFilter = filter;
			return query(null);
		};

		const accepted = responseRecorder();
		await updateProductController({
			params: { id: "17" },
			body: {
				descripcion: "Cambio",
				_expectedUpdatedAt: "2026-10-23T12:00:00+02:00"
			}
		}, accepted);
		assert.equal(accepted.statusCode, 409);
		assert.ok(capturedFilter.updatedAt instanceof Date);
		assert.equal(capturedFilter.updatedAt.toISOString(), "2026-10-23T10:00:00.000Z");

		for (const invalidVersion of [
			"2026-10-23", "23/10/2026 12:00", "not-a-date", "", 0, {}, [],
			"2026-02-30T12:00:00Z", "2025-02-29T12:00:00Z", "2026-10-23T24:00:00Z"
		]) {
			const rejected = responseRecorder();
			await updateProductController({
				params: { id: "17" },
				body: { descripcion: "No escribir", _expectedUpdatedAt: invalidVersion }
			}, rejected);
			assert.equal(rejected.statusCode, 400);
		}
	});
});

test("estado comercial es independiente del stock y stock desconocido no se inventa", () => {
	const current = { id: "17", stock: null, estado: "sin stock", variantes: [{ sku: "KEEP", medida: "20mm" }] };
	assert.deepEqual(buildUpdatePayload({ estado: "disponible" }, current), { estado: "disponible" });
	assert.deepEqual(buildUpdatePayload({ estado: "sin stock" }, { ...current, stock: 0 }), {
		estado: "sin stock"
	});
	assert.deepEqual(buildUpdatePayload({ stock: 0 }, current), { stock: 0 });
	assert.deepEqual(buildUpdatePayload({ stock: "" }, current), { stock: null });
	assert.throws(() => buildUpdatePayload({ stock: "no válido" }, current), /stock/);

	const created = buildCreatePayload({ nombre: "Producto", codigo: "PROD-1", imagen: "/img.webp" });
	assert.equal(Object.hasOwn(created, "stock"), false);
	assert.equal(new ProductModel({ ...created, id: "18" }).stock, null);
	assert.deepEqual(buildImportPayload({
		codigo: "PROD-2",
	}).codigo, "PROD-2");
	assert.equal(Object.hasOwn(buildImportPayload({ codigo: "PROD-2" }), "nombre"), false);
	assert.equal(buildImportPayload({
		codigo: "PROD-3",
		stock: 0
	}).stock, 0);
	assert.equal(buildImportPayload({
		codigo: "PROD-4",
		stock: ""
	}).stock, undefined);
	assert.equal(buildImportPayload({ codigo: "PROD-5", stock: null }).stock, undefined);
	assert.throws(() => buildImportPayload({ codigo: "PROD-6", stock: -1 }), /stock/);
	assert.throws(() => buildImportPayload({ codigo: "PROD-7", stock: "texto" }), /stock/);
	assert.throws(() => buildImportPayload({ nombre: "Sin código" }), /codigo es obligatorio/i);
	assert.equal(ProductModel.schema.path("stock").defaultValue, null);
});

test("PUT parcial de familia preserva categoría omitida", () => {
	const patch = buildUpdatePayload({ familia: "Nueva" }, {
		familia: "Anterior", familiaSlug: "anterior",
		subfamilia: "Sub", subfamiliaSlug: "sub", categoria: "Conservar", categoriaSlug: "conservar"
	});
	assert.equal(Object.hasOwn(patch, "categoria"), false);
	assert.equal(Object.hasOwn(patch, "categoriaSlug"), false);
	assert.deepEqual(patch, { familia: "Nueva", familiaSlug: "nueva" });
});

test("editar solo categoría desde formulario parcial no la convierte en familia ni borra subfamilia", () => {
	const current = {
		familia: "Tubería", familiaSlug: "tuberia", subfamilia: "PVC", subfamiliaSlug: "pvc",
		categoria: "Anterior", categoriaSlug: "anterior"
	};
	const patch = buildUpdatePayload({ categoria: "Nueva", categoriaSlug: "nueva" }, current);
	assert.deepEqual(patch, { categoria: "Nueva", categoriaSlug: "nueva" });
	assert.deepEqual(buildUpdatePayload({ subfamiliaSlug: "otro" }, current), { subfamiliaSlug: "otro" });
	assert.deepEqual(buildUpdatePayload({ categoria: "", categoriaSlug: "" }, current), {
		categoria: "", categoriaSlug: ""
	});
});

test("versiones nulas solo ganan una vez, fechas futuras avanzan y documentos inválidos no se escriben", async () => {
	await withMockedDatabase(async () => {
		for (const initial of [undefined, null, new Date("2099-01-01T00:00:00Z"), "corrupt-date"]) {
			const current = { id: "17", codigo: "SKU", nombre: "Original", imagen: "/keep", updatedAt: initial };
			ProductModel.findOne = () => query({ ...current });
			ProductModel.findOneAndUpdate = (filter, update) => {
				const matches = filter.updatedAt === null
					? current.updatedAt == null
					: current.updatedAt instanceof Date && current.updatedAt.getTime() === filter.updatedAt.getTime();
				if (!matches) return query(null);
				Object.assign(current, update.$set);
				return query({ ...current });
			};
			if (initial === "corrupt-date") {
				await assert.rejects(updateProductById("17", { nombre: "No" }, null), { status: 409 });
				assert.equal(current.nombre, "Original");
				await assert.rejects(updateProductById("17", { nombre: "No" }, initial), /no es válida/);
				continue;
			}
			const expected = initial ?? null;
			const winner = await updateProductById("17", { nombre: "Ganador" }, expected);
			assert.ok(winner.updatedAt instanceof Date);
			if (initial instanceof Date) assert.ok(winner.updatedAt > initial);
			await assert.rejects(updateProductById("17", { nombre: "Perdedor" }, expected), { status: 409 });
			assert.equal(current.nombre, "Ganador");
		}
	});
});

test("imagen avanza la versión incluso con reloj atrasado e invalida el PUT anterior", async () => {
	await withMockedDatabase(async () => {
		const oldVersion = new Date("2099-01-01T00:00:00Z");
		const current = { id: "17", codigo: "SKU", nombre: "Original", imagen: "/old", updatedAt: oldVersion };
		ProductModel.findOne = () => query({ ...current });
		ProductModel.findOneAndUpdate = (filter, update) => {
			if (filter.updatedAt.getTime() !== current.updatedAt.getTime()) return query(null);
			Object.assign(current, update.$set);
			return query({ ...current });
		};
		assert.equal(await associateProductImage("17", "/old", "/new"), true);
		assert.equal(current.updatedAt.getTime(), oldVersion.getTime() + 1);
		assert.equal(current.imagen, "/new");
		await assert.rejects(updateProductById("17", { nombre: "Obsoleto" }, oldVersion), { status: 409 });
		assert.equal(current.nombre, "Original");
		assert.equal(await associateProductImage("17", "/old", "/other"), false);
	});
});

test("carrera de imagen contra metadata falla sin escritura parcial ni pérdida de campos", async () => {
	await withMockedDatabase(async () => {
		const current = { id: "17", codigo: "SKU", imagen: "/old", precioCosto: 20, updatedAt: new Date() };
		let update;
		ProductModel.findOne = () => query({ ...current });
		ProductModel.findOneAndUpdate = (filter, value) => {
			update = value;
			current.precioCosto = 30;
			current.updatedAt = new Date(current.updatedAt.getTime() + 1);
			return query(null);
		};
		assert.equal(await associateProductImage("17", "/old", "/new"), false);
		assert.equal(current.imagen, "/old");
		assert.equal(current.precioCosto, 30);
		assert.deepEqual(Object.keys(update.$set).sort(), ["imagen", "updatedAt"]);
	});
});

test("limpieza de referencias usa pipeline atómico con versión monotónica, sin timestamps automáticos", async () => {
	await withMockedDatabase(async () => {
		let call;
		ProductModel.findOneAndDelete = () => query({ id: "17", codigo: "SKU", imagen: "/old" });
		ProductModel.updateMany = async (...args) => { call = args; };
		await deleteProductById("17");
		assert.deepEqual(call[0], { relatedProductIds: "17" });
		assert.deepEqual(call[2], { timestamps: false, updatePipeline: true });
		const set = call[1][0].$set;
		assert.deepEqual(Object.keys(set).sort(), ["relatedProductIds", "updatedAt"]);
		assert.deepEqual(set.updatedAt.$cond[1], { $max: ["$$NOW", { $add: ["$updatedAt", 1] }] });
		assert.deepEqual(set.relatedProductIds.$filter.cond, { $ne: ["$$relatedId", { $literal: "17" }] });
	});
});

for (const stock of [undefined, null, "", "  ", 0, "0", 7, "7.5"]) {
	test(`stock importado ${JSON.stringify(stock)}: existentes y nuevos preservan desconocido o cero explícito`, async () => {
		await withMockedDatabase(async () => {
			for (const exists of [true, false]) {
				let operation;
				ProductModel.find = (filter) => query(filter.codigo
					? (exists ? [{ id: "17", codigo: "SKU", updatedAt: null }] : [])
					: [{ id: exists ? "17" : operation.insertOne.document.id, codigo: "SKU" }]);
				ProductModel.bulkWrite = async (operations) => {
					[operation] = operations;
					return { matchedCount: exists ? 1 : 0 };
				};
				const payload = buildImportPayload({
					codigo: "SKU", nombre: "Nuevo", familia: "Familia", subfamilia: "Sub", precioCosto: 10, stock
				});
				await bulkUpsertProductsByCode([payload]);
				const written = exists ? operation.updateOne.update.$set : operation.insertOne.document;
				if (stock == null || String(stock).trim() === "") {
					if (exists) assert.equal(Object.hasOwn(written, "stock"), false);
					else assert.equal(written.stock, null);
				} else assert.equal(written.stock, Number(stock));
			}
		});
	});
}

test("stock inválido es rechazado en parser y store antes de toda escritura, incluso para altas", async () => {
	await withMockedDatabase(async () => {
		let writes = 0;
		ProductModel.bulkWrite = async () => { writes += 1; };
		for (const stock of [-1, "texto", "2 unidades", true, false, [], {}, NaN, Infinity, "Infinity"]) {
			assert.throws(() => buildImportPayload({ codigo: "SKU", stock }), /stock/);
			for (const exists of [true, false]) {
				ProductModel.find = () => query(exists ? [{ id: "17", codigo: "SKU", updatedAt: null }] : []);
				await assert.rejects(bulkUpsertProductsByCode([{
					codigo: "SKU", nombre: "Nuevo", familia: "Familia", subfamilia: "Sub", precioCosto: 10, stock
				}]), /stock/);
			}
		}
		assert.equal(writes, 0);
	});
});

test("parser Excel no extrae números de texto, fechas, fórmulas sin resultado ni booleanos", () => {
	for (const invalid of ["texto", "2 unidades", "abc0", "$20", "1.2.3", "", "  ", true, null, {}, []]) {
		assert.ok(Number.isNaN(parseExcelNumber(invalid)), JSON.stringify(invalid));
	}
	for (const [input, expected] of [[0, 0], ["0", 0], ["1.000", 1000], ["1,5", 1.5],
		["1.234,50", 1234.5], ["1,234.50", 1234.5], ["-1", -1]]) {
		assert.equal(parseExcelNumber(input), expected);
	}
});

test("identificador no confiable no se convierte en otro código", () => {
	for (const codigo of [undefined, null, "", "///", "A/B", {}, true, []]) {
		assert.throws(() => buildImportPayload({ codigo }), /codigo/);
	}
	assert.equal(buildImportPayload({ codigo: " sku 17 " }).codigo, "SKU-17");
});

test("alta importada usa ID nuevo, stock desconocido y campos protegidos definidos por servidor", async () => {
	await withMockedDatabase(async () => {
		let document;
		ProductModel.find = (filter) => query(filter.codigo ? [] : [document]);
		ProductModel.bulkWrite = async ([operation]) => {
			document = operation.insertOne.document;
			return { matchedCount: 0 };
		};
		const [result] = await bulkUpsertProductsByCode([{
			codigo: "NEW", nombre: "Nuevo", familia: "Familia", subfamilia: "Sub", precioCosto: 10,
			id: "INJECTED", imagen: "/unauthorized", variantes: [{ sku: "INJECTED" }],
			estado: "sin stock", relatedProductIds: ["17"]
		}]);
		assert.equal(result.created, true);
		assert.notEqual(document.id, "INJECTED");
		assert.equal(document.stock, null);
		assert.equal(document.imagen, "/assets/images/producto-sin-imagen.svg");
		assert.equal(document.estado, "disponible");
		assert.deepEqual(document.variantes, []);
		assert.deepEqual(document.relatedProductIds, []);
	});
});

test("duplicados existentes en BD y updatedAt inválido bloquean la importación sin escribir", async () => {
	await withMockedDatabase(async () => {
		let writes = 0;
		ProductModel.bulkWrite = async () => { writes += 1; };
		ProductModel.find = () => query([{ id: "1", codigo: "DUP" }, { id: "2", codigo: "DUP" }]);
		await assert.rejects(bulkUpsertProductsByCode([{ codigo: "DUP", nombre: "No" }]), { status: 409 });
		ProductModel.find = () => query([{ id: "1", codigo: "DUP", updatedAt: "invalid" }]);
		await assert.rejects(bulkUpsertProductsByCode([{ codigo: "DUP", nombre: "No" }]), /versión.*no es válida/);
		assert.equal(writes, 0);
	});
});

test("cliente de importación anterior sin batchId recibe 428 sin enviar bulk", async () => {
	await withMockedDatabase(async () => {
		ProductModel.find = () => query([
			{ id: "1", codigo: "ONE", updatedAt: null }, { id: "2", codigo: "TWO", updatedAt: null }
		]);
		ProductModel.bulkWrite = async () => ({ matchedCount: 1 });
		const response = responseRecorder();
		await bulkImportProductsController({ body: { products: [
			{ codigo: "ONE", nombre: "Primero" }, { codigo: "TWO", nombre: "Segundo" }
		] } }, response);
		assert.equal(response.statusCode, 428);
		assert.equal(response.body.code, "BATCH_ID_REQUIRED");
		assert.equal(Object.hasOwn(response.body, "updated"), false);
	});
});

test("filas duplicadas sin identidad de lote no eluden el requisito batchId", async () => {
	await withMockedDatabase(async () => {
		let operations;
		ProductModel.find = () => query([{ id: "17", codigo: "SKU", updatedAt: null }]);
		ProductModel.bulkWrite = async (value) => { operations = value; return { matchedCount: 1 }; };
		const response = responseRecorder();
		await bulkImportProductsController({ body: { products: [
			{ codigo: "SKU", nombre: "Primero", rowNumber: 2 },
			{ codigo: "sku", nombre: "Segundo", rowNumber: 3 }
		] } }, response);
		assert.equal(response.statusCode, 428);
		assert.equal(operations, undefined);
	});

	test("PUT inexistente devuelve 404 y versión ausente o inválida no consulta ni escribe", async () => {
		await withMockedDatabase(async () => {
			let reads = 0;
			let writes = 0;
			ProductModel.findOne = () => { reads += 1; return query(null); };
			ProductModel.findOneAndUpdate = () => { writes += 1; return query(null); };
			for (const [body, status] of [
				[{ nombre: "Sin versión" }, 428],
				[{ nombre: "Inválida", _expectedUpdatedAt: "local date" }, 400],
				[{ nombre: "No existe", _expectedUpdatedAt: null }, 404]
			]) {
				const response = responseRecorder();
				await updateProductController({ params: { id: "missing" }, body }, response);
				assert.equal(response.statusCode, status);
			}
			assert.equal(reads, 1);
			assert.equal(writes, 0);
		});
	});

	test("lote sin batchId no escribe siquiera la primera fila", async () => {
		await withMockedDatabase(async () => {
			const applied = [];
			ProductModel.find = () => query([]);
			ProductModel.bulkWrite = async (operations, options) => {
				assert.equal(options.ordered, true);
				applied.push(operations[0].insertOne.document.codigo);
				throw new Error("second write failed");
			};
			const response = responseRecorder();
			await bulkImportProductsController({ body: { products: ["ONE", "TWO"].map((codigo) => ({
				codigo, nombre: codigo, familia: "Familia", subfamilia: "Sub", precioCosto: 10
			})) } }, response);
			assert.equal(response.statusCode, 428);
			assert.deepEqual(applied, []);
			assert.equal(Object.hasOwn(response.body, "created"), false);
		});
	});

	test("resultado de escritura sin confirmación o producto borrado al releer no genera éxito ficticio", async () => {
		await withMockedDatabase(async () => {
			for (const confirmation of [undefined, { matchedCount: 1 }]) {
				let reads = 0;
				ProductModel.find = () => query(++reads === 1 ? [{ id: "17", codigo: "SKU", updatedAt: null }] : []);
				ProductModel.bulkWrite = async () => confirmation;
				await assert.rejects(bulkUpsertProductsByCode([{ codigo: "SKU", nombre: "Cambio" }]), {
					status: 500, partialPossible: true
				});
			}
		});
	});
});
