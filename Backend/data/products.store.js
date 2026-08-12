import mongoose from "mongoose";

import { products as seedProducts } from "./products.sample.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/vgv";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || undefined;

let connectionPromise = null;
let seeded = false;

const productSchema = new mongoose.Schema(
	{
		id: { type: String, required: true, unique: true },
		codigo: { type: String, required: true },
		nombre: { type: String, required: true },
		precio: { type: Number, required: true },
		descripcion: { type: String, default: "" },
		imagen: { type: String, required: true },
		categoria: { type: String, default: "Sin categoria" },
		categoriaSlug: { type: String, default: "sin-categoria" },
		variantes: [
			{
				sku: { type: String, default: "" },
				medida: { type: String, default: "" },
				precio: { type: Number, default: 0 },
				minima: { type: Number, default: 1 }
			}
		],
		stock: { type: Number, default: 0 },
		estado: { type: String, enum: ["disponible", "sin stock"], default: "disponible" }
	},
	{
		timestamps: true,
		versionKey: false
	}
);

const ProductModel = mongoose.models.Product || mongoose.model("Product", productSchema);

const seedVariantsById = new Map(
	seedProducts
		.filter((product) => Array.isArray(product.variantes) && product.variantes.length > 0)
		.map((product) => [String(product.id), product.variantes])
);

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

function normalizeVariantes(variantes, fallbackId = "") {
	const source = Array.isArray(variantes) && variantes.length > 0 ? variantes : seedVariantsById.get(String(fallbackId));
	if (!Array.isArray(source)) return [];

	return source
		.map((variante, index) => {
			const sku = String(variante?.sku || `${String(fallbackId)}-${index + 1}`).trim();
			const medida = String(variante?.medida || "").trim();
			const precio = Number(variante?.precio ?? 0);
			const minima = Number(variante?.minima ?? 1);

			return {
				sku,
				medida,
				precio: Number.isFinite(precio) && precio >= 0 ? precio : 0,
				minima: Number.isFinite(minima) && minima > 0 ? Math.floor(minima) : 1
			};
		})
		.filter((variante) => variante.sku && variante.medida);
}

function normalizeEstado(producto) {
	const stock = Number(producto.stock ?? 0);
	const estado = String(producto.estado || (stock > 0 ? "disponible" : "sin stock")).toLowerCase();
	const id = String(producto.id);

	return {
		...producto,
		id,
		codigo: buildProductCode({ ...producto, id }),
		nombre: String(producto.nombre ?? "").trim(),
		precio: Number.isFinite(Number(producto.precio ?? 0)) ? Number(producto.precio ?? 0) : 0,
		descripcion: String(producto.descripcion ?? ""),
		imagen: String(producto.imagen ?? ""),
		categoria: String(producto.categoria ?? "Sin categoria"),
		categoriaSlug: String(producto.categoriaSlug ?? "sin-categoria"),
		variantes: normalizeVariantes(producto.variantes, id),
		stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
		estado: estado === "sin stock" ? "sin stock" : "disponible",
		createdAt: producto.createdAt ?? null,
		updatedAt: producto.updatedAt ?? null
	};
}

function toProductDTO(document) {
	if (!document) return null;
	return normalizeEstado(document);
}

export async function connectProductsDatabase() {
	if (mongoose.connection.readyState === 1) {
		return mongoose.connection;
	}

	if (!connectionPromise) {
		connectionPromise = mongoose.connect(MONGO_URI, {
			dbName: MONGO_DB_NAME
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
	seeded = false;
}

async function seedIfEmpty() {
	if (seeded) return;

	const count = await ProductModel.countDocuments({});
	if (count === 0) {
		await ProductModel.insertMany(seedProducts.map(normalizeEstado));
	}

	seeded = true;
}

async function ensureReady() {
	await connectProductsDatabase();
	await seedIfEmpty();
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

export async function createProduct(payload) {
	await ensureReady();
	const existingProducts = await ProductModel.find({}, { id: 1, _id: 0 }).lean();
	const existingIds = existingProducts
		.map((product) => Number(product.id))
		.filter((value) => Number.isFinite(value));
	const nextId = payload.id ?? (existingIds.length ? String(Math.max(...existingIds) + 1) : String(Date.now()));

	const created = await ProductModel.create(normalizeEstado({ ...payload, id: String(nextId) }));
	return toProductDTO(created.toObject());
}

export async function updateProductById(id, patch) {
	await ensureReady();
	const currentProduct = await ProductModel.findOne({ id: String(id) }).lean();
	if (!currentProduct) {
		return null;
	}

	const nextProduct = normalizeEstado({
		...currentProduct,
		...patch,
		id: String(id)
	});

	const updated = await ProductModel.findOneAndUpdate(
		{ id: String(id) },
		{ $set: nextProduct },
		{ new: true, runValidators: true }
	).lean();

	return toProductDTO(updated);
}

export async function deleteProductById(id) {
	await ensureReady();
	const deleted = await ProductModel.findOneAndDelete({ id: String(id) }).lean();
	if (!deleted) {
		return null;
	}

	return toProductDTO(deleted);
}