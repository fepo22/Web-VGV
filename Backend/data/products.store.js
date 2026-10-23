import mongoose from "mongoose";

import { products as seedProducts } from "./products.sample.js";
import { canonicalProductCode, requireCodeIndex, duplicateCodeError } from "../utils/product-code.js";
import { protectImageReference } from "../utils/image-lifecycle.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/vgv";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || undefined;

let connectionPromise = null;
const legacyFamilySlugs = {
	canalizacion: "canalizacion-tuberia",
	"griferias-sanitarios": "bano-cocina",
	"calefont-calefaccion": "calefaccion"
};

const productSchema = new mongoose.Schema(
	{
		id: { type: String, required: true, unique: true },
		codigo: { type: String, required: true },
		nombre: { type: String, required: true },
		descripcion: { type: String, default: "" },
		imagen: { type: String, required: true },
		relatedProductIds: { type: [String], default: [] },
		familia: { type: String, default: "Sin categoria" },
		familiaSlug: { type: String, default: "sin-categoria" },
		subfamilia: { type: String, default: "" },
		subfamiliaSlug: { type: String, default: "" },
		categoria: { type: String, default: "Sin categoria" },
		categoriaSlug: { type: String, default: "sin-categoria" },
		precioCosto: { type: Number, min: 0, default: 0 },
		variantes: [
			{
				sku: { type: String, default: "" },
				medida: { type: String, default: "" },
				minima: { type: Number, default: 1 }
			}
		],
		stock: { type: Number, default: null },
		estado: { type: String, enum: ["disponible", "sin stock"], default: "disponible" }
	},
	{
		timestamps: true,
		versionKey: false
	}
);

productSchema.index({ codigo: 1 });
productSchema.index({ createdAt: -1, id: -1 });

const ProductModel = mongoose.models.Product || mongoose.model("Product", productSchema);

const IMPORT_UPDATE_FIELDS = new Set([
	"nombre",
	"familia",
	"familiaSlug",
	"subfamilia",
	"subfamiliaSlug",
	"categoria",
	"categoriaSlug",
	"stock"
]);

export class ProductUpdateConflictError extends Error {
	constructor({ partialPossible = false } = {}) {
		super(partialPossible
			? "La importación encontró cambios concurrentes. Algunas filas del lote podrían haberse aplicado; actualiza el catálogo antes de reintentar."
			: "El producto cambió desde que lo cargaste. Actualiza la ficha y vuelve a aplicar tus cambios.");
		this.name = "ProductUpdateConflictError";
		this.status = 409;
		this.partialPossible = partialPossible;
	}
}

class ProductImportPartialError extends Error {
	constructor() {
		super("La importación se interrumpió durante la escritura. Algunas filas podrían haberse aplicado; actualiza el catálogo antes de reintentar.");
		this.name = "ProductImportPartialError";
		this.status = 500;
		this.partialPossible = true;
	}
}

class ProductImportValidationError extends Error {
	constructor(field) {
		super(`El campo ${field} es obligatorio para crear un producto nuevo.`);
		this.name = "ProductImportValidationError";
		this.status = 400;
	}
}

function nextUpdatedAt(expectedUpdatedAt) {
	const now = Date.now();
	const previous = expectedUpdatedAt instanceof Date ? expectedUpdatedAt.getTime() : 0;
	const next = new Date(Math.max(now, previous + 1));
	if (!Number.isFinite(next.getTime())) throw new Error("La versión del producto no permite otra actualización.");
	return next;
}

function validateExpectedUpdatedAt(value) {
	if (value === null) return null;
	if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
		throw new Error("La versión del producto no es válida.");
	}
	return value;
}

function normalizeCode(value = "") {
	return String(value)
		.trim()
		.toUpperCase()
		.replace(/\s+/g, "-")
		.replace(/[^A-Z0-9-_]/g, "");
}

function buildProductCode(producto = {}) {
	const fromPayload = normalizeCode(producto.codigo);
	if (fromPayload) return fromPayload;

	const numericId = Number(producto.id);
	if (Number.isFinite(numericId)) {
		return `VGV-${String(Math.trunc(numericId)).padStart(4, "0")}`;
	}

	const fromId = normalizeCode(producto.id);
	if (fromId) return `VGV-${fromId}`;

	return `VGV-${Date.now()}`;
}

function normalizeEstado(producto) {
	const stockValue = producto.stock;
	const stock = stockValue === null || stockValue === undefined || stockValue === ""
		? null
		: Number(stockValue);
	const estado = String(producto.estado || "disponible").toLowerCase();
	const id = String(producto.id);
	const isLegacyCategory = !producto.familia && Boolean(producto.categoria);
	const familia = String(producto.familia ?? producto.categoria ?? "Sin categoria");
	const rawFamiliaSlug = String(producto.familiaSlug ?? producto.categoriaSlug ?? "sin-categoria");
	const familiaSlug = legacyFamilySlugs[rawFamiliaSlug] ?? rawFamiliaSlug;

	return {
		id,
		codigo: buildProductCode({ ...producto, id }),
		nombre: String(producto.nombre ?? "").trim(),
		descripcion: String(producto.descripcion ?? ""),
		imagen: String(producto.imagen ?? ""),
		relatedProductIds: Array.isArray(producto.relatedProductIds)
			? [...new Set(producto.relatedProductIds.map(String))].filter((relatedId) => relatedId !== id)
			: [],
		familia,
		familiaSlug,
		subfamilia: String(producto.subfamilia ?? ""),
		subfamiliaSlug: String(producto.subfamiliaSlug ?? ""),
		categoria: isLegacyCategory ? "" : String(producto.categoria ?? ""),
		categoriaSlug: isLegacyCategory ? "" : String(producto.categoriaSlug ?? ""),
		precioCosto: Number.isFinite(Number(producto.precioCosto)) && Number(producto.precioCosto) >= 0
			? Number(producto.precioCosto)
			: 0,
		variantes: Array.isArray(producto.variantes) ? producto.variantes.map((variante) => ({ ...variante })) : [],
		stock: stock === null ? null : Number.isFinite(stock) && stock >= 0 ? stock : null,
		estado: estado === "sin stock" ? "sin stock" : "disponible",
		createdAt: producto.createdAt ?? null,
		updatedAt: producto.updatedAt ?? null
	};
}

function toProductDTO(document) {
	if (!document) return null;
	const product = typeof document.toObject === "function" ? document.toObject() : document;
	return {
		...normalizeEstado(product),
		variantes: Array.isArray(product.variantes) ? product.variantes.map((variante) => ({ ...variante })) : []
	};
}

export async function connectProductsDatabase() {
	if (process.env.VERCEL && !process.env.MONGO_URI && !process.env.MONGODB_URI) {
		throw new Error("Falta MONGO_URI o MONGODB_URI en el entorno del servicio backend de Vercel");
	}

	if (mongoose.connection.readyState === 1) {
		return mongoose.connection;
	}

	if (!connectionPromise) {
		connectionPromise = mongoose.connect(MONGO_URI, {
			dbName: MONGO_DB_NAME
		}).catch((error) => {
			connectionPromise = null;
			throw error;
		});
	}

	return connectionPromise;
}

export async function disconnectProductsDatabase() {
	if (mongoose.connection.readyState === 0) {
		connectionPromise = null;
		return;
	}

	await mongoose.disconnect();
	connectionPromise = null;
}

export async function syncSeedProducts({ removeMissing = false } = {}) {
	if (removeMissing) {
		throw new Error("La eliminación de productos ausentes está deshabilitada.");
	}
	const localMongoUri = /^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i;
	if (
		process.env.VERCEL ||
		process.env.NODE_ENV === "production" ||
		!localMongoUri.test(MONGO_URI)
	) {
		throw new Error("La sincronización seed solo puede ejecutarse contra MongoDB local fuera de producción.");
	}
	await connectProductsDatabase();
	await requireCodeIndex(ProductModel);

	for (const product of seedProducts.map(normalizeEstado)) {
		product.codigo = canonicalProductCode(product.codigo);
		await protectImageReference(product.imagen);
		const insertedAt = new Date();
		await ProductModel.updateOne(
			{ id: String(product.id) },
			{ $setOnInsert: { ...product, createdAt: insertedAt, updatedAt: insertedAt } },
			{ upsert: true, timestamps: false }
		);
	}

	const products = await ProductModel.find({}).sort({ createdAt: -1, id: -1 }).lean();
	return products.map(toProductDTO).filter(Boolean);
}

async function ensureReady() {
	await connectProductsDatabase();
}

export async function listProducts() {
	await ensureReady();
	const products = await ProductModel.find({}).sort({ createdAt: -1, id: -1 }).lean();
	return products.map(toProductDTO).filter(Boolean);
}

export async function getProductById(id) {
	await ensureReady();
	const product = await ProductModel.findOne({ id: String(id) }).lean();
	return toProductDTO(product);
}

export async function getProductsByIds(ids) {
	if (!ids.length) return [];
	await ensureReady();
	const products = await ProductModel.find({ id: { $in: ids } }).lean();
	const byId = new Map(products.map((product) => [String(product.id), toProductDTO(product)]));
	return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

export async function createProduct(payload) {
	await ensureReady();
	await requireCodeIndex(ProductModel);
	const codigo = canonicalProductCode(payload.codigo);
	await protectImageReference(payload.imagen);
	const nextId = payload.id ?? new mongoose.Types.ObjectId().toString();

	let created;
	try {
		created = await ProductModel.create(normalizeEstado({ ...payload, codigo, id: String(nextId) }));
	} catch (error) {
		throw duplicateCodeError(error);
	}
	return toProductDTO(created.toObject());
}

export async function bulkUpsertProductsByCode(payloads) {
	payloads = payloads.map((payload) => {
		if (!payload.codigo) throw new Error("Cada fila de importación debe tener un código único.");
		return { ...payload, codigo: canonicalProductCode(payload.codigo) };
	});
	const seenCodes = new Set();
	for (const payload of payloads) {
		if (!payload.codigo || seenCodes.has(payload.codigo)) {
			throw new Error("Cada fila de importación debe tener un código único.");
		}
		seenCodes.add(payload.codigo);
	}
	await ensureReady();
	const codes = payloads.map((payload) => payload.codigo);
	const existingProducts = await ProductModel.find(
		{ codigo: { $in: codes } },
		{ id: 1, codigo: 1, updatedAt: 1, _id: 0 }
	).lean();

	if (new Set(existingProducts.map((product) => product.codigo)).size !== existingProducts.length) {
		throw new ProductUpdateConflictError();
	}
	const existingByCode = new Map(existingProducts.map((product) => [product.codigo, product]));
	const operations = [];
	const outcomes = [];

	for (const payload of payloads) {
		const existing = existingByCode.get(payload.codigo);
		if (existing) {
			const patch = {};
			for (const [field, value] of Object.entries(payload)) {
				if (!IMPORT_UPDATE_FIELDS.has(field)) continue;
				if (field === "stock") {
					if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) continue;
					if (typeof value !== "number" &&
						(typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim()))) {
						throw new Error("El stock de importación debe ser un número válido mayor o igual a 0.");
					}
					const stock = Number(value);
					if (!Number.isFinite(stock) || stock < 0) {
						throw new Error("El stock de importación debe ser un número válido mayor o igual a 0.");
					}
					patch.stock = stock;
					continue;
				}
				const text = String(value ?? "").trim();
				if (text) patch[field] = text;
			}
			if (Object.keys(patch).length) {
				const expectedUpdatedAt = validateExpectedUpdatedAt(existing.updatedAt ?? null);
				operations.push({
					updateOne: {
						filter: { id: existing.id, updatedAt: expectedUpdatedAt },
						update: { $set: { ...patch, updatedAt: nextUpdatedAt(expectedUpdatedAt) } },
						runValidators: true,
						timestamps: false
					}
				});
			}
			outcomes.push({ id: existing.id, created: false });
		} else {
			await requireCodeIndex(ProductModel);
			for (const field of ["nombre", "familia", "subfamilia", "precioCosto"]) {
				if (payload[field] === undefined || payload[field] === null || String(payload[field]).trim() === "") {
					throw new ProductImportValidationError(field);
				}
			}
			if ((typeof payload.precioCosto !== "number" && typeof payload.precioCosto !== "string") ||
				!Number.isFinite(Number(payload.precioCosto)) || Number(payload.precioCosto) < 0) {
				throw new ProductImportValidationError("precioCosto válido");
			}
			const imported = Object.fromEntries(Object.entries(payload).filter(([field]) =>
				IMPORT_UPDATE_FIELDS.has(field) || field === "codigo" || field === "precioCosto"
			));
			if (imported.stock === null || imported.stock === undefined ||
				(typeof imported.stock === "string" && imported.stock.trim() === "")) {
				delete imported.stock;
			} else if ((typeof imported.stock !== "number" &&
				(typeof imported.stock !== "string" || !/^\d+(?:\.\d+)?$/.test(imported.stock.trim()))) ||
				!Number.isFinite(Number(imported.stock)) || Number(imported.stock) < 0) {
				throw new Error("El stock de importación debe ser un número válido mayor o igual a 0.");
			}
			const id = new mongoose.Types.ObjectId().toString();
			operations.push({
				insertOne: {
					document: normalizeEstado({
						...imported,
						imagen: "/assets/images/producto-sin-imagen.svg",
						id
					})
				}
			});
			outcomes.push({ id, created: true });
		}
	}

	try {
		if (operations.length) {
			const result = await ProductModel.bulkWrite(operations, { ordered: true });
			const expectedUpdates = operations.filter((operation) => operation.updateOne).length;
			if (typeof result?.matchedCount !== "number") throw new ProductImportPartialError();
			if (result.matchedCount < expectedUpdates) {
				throw new ProductUpdateConflictError({ partialPossible: true });
			}
		}

		const savedProducts = await ProductModel.find(
			{ id: { $in: outcomes.map((outcome) => outcome.id) } }
		).lean();
		const savedById = new Map(savedProducts.map((product) => [String(product.id), toProductDTO(product)]));
		if (outcomes.some((outcome) => !savedById.has(outcome.id))) throw new ProductImportPartialError();
		return outcomes.map((outcome) => ({
			product: savedById.get(outcome.id),
			created: outcome.created
		}));
	} catch (error) {
		if (error instanceof ProductUpdateConflictError) throw error;
		throw new ProductImportPartialError();
	}
}

export async function updateProductById(id, patch, expectedUpdatedAt) {
	await ensureReady();
	if (expectedUpdatedAt === undefined) {
		throw new Error("La versión del producto es obligatoria para actualizar.");
	}
	const expectedVersion = validateExpectedUpdatedAt(expectedUpdatedAt);
	if (Object.hasOwn(patch, "codigo")) {
		await requireCodeIndex(ProductModel);
		patch = { ...patch, codigo: canonicalProductCode(patch.codigo) };
	}
	if (Object.hasOwn(patch, "imagen")) await protectImageReference(patch.imagen);
	let updated;
	try {
		updated = await ProductModel.findOneAndUpdate(
		{ id: String(id), updatedAt: expectedVersion },
		{ $set: { ...patch, updatedAt: nextUpdatedAt(expectedVersion) } },
		{ new: true, runValidators: true, timestamps: false }
	).lean();
	} catch (error) {
		throw duplicateCodeError(error);
	}

	if (!updated) {
		const existing = await ProductModel.findOne({ id: String(id) }, { id: 1, _id: 0 }).lean();
		if (existing) throw new ProductUpdateConflictError();
		return null;
	}

	return toProductDTO(updated);
}

export async function deleteProductById(id) {
	await ensureReady();
	const deleted = await ProductModel.findOneAndDelete({ id: String(id) }).lean();
	if (!deleted) {
		return null;
	}

	await ProductModel.updateMany(
		{ relatedProductIds: String(id) },
		[{
			$set: {
				relatedProductIds: {
					$filter: {
						input: "$relatedProductIds",
						as: "relatedId",
						cond: { $ne: ["$$relatedId", { $literal: String(id) }] }
					}
				},
				updatedAt: {
					$cond: [
						{ $eq: [{ $type: "$updatedAt" }, "date"] },
						{ $max: ["$$NOW", { $add: ["$updatedAt", 1] }] },
						"$$NOW"
					]
				}
			}
		}],
		{ timestamps: false, updatePipeline: true }
	);
	return toProductDTO(deleted);
}