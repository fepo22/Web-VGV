import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import { connectProductsDatabase } from "./products.store.js";
import { ProductWriteError, requireCodeIndex, duplicateCodeError } from "../utils/product-code.js";

const allowed = ["nombre", "familia", "familiaSlug", "subfamilia", "subfamiliaSlug", "categoria", "categoriaSlug", "stock"];
const confirmed = new Set(["created", "updated", "unchanged"]);
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
	? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const hashRows = (rows) => createHash("sha256").update(JSON.stringify(stable(rows))).digest("hex");

function validateBatchId(batchId) {
	if (!batchId) throw new ProductWriteError("La importación requiere batchId estable para reconciliar reintentos.", 428, "BATCH_ID_REQUIRED");
	if (typeof batchId !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(batchId)) {
		throw new ProductWriteError("batchId no válido.", 400, "INVALID_BATCH_ID");
	}
}

export function importReport(receipt) {
	const rows = receipt.rows.map(({ payload, ...row }) => ({
		...row,
		status: row.status === "applying" ? "unknown" : row.status,
		action: confirmed.has(row.status) ? "No reenviar: fila confirmada."
			: row.status === "rejected" ? "Corregir entrada y enviar con una identidad nueva."
			: ["pending", "failed", "conflict"].includes(row.status) ? "Revisar precondiciones y reintentar explícitamente solo esta fila."
			: "No reintentar: reconciliar el resultado desconocido."
	}));
	const count = (status) => rows.filter((row) => row.status === status).length;
	return {
		batchId: receipt._id, complete: rows.every((row) => confirmed.has(row.status)),
		processing: Boolean(receipt.lock), received: rows.length,
		processed: rows.filter((row) => !["pending", "unknown"].includes(row.status)).length,
		attempted: rows.filter((row) => row.attempts > 0).length,
		confirmed: rows.filter((row) => confirmed.has(row.status)).length,
		created: count("created"), updated: count("updated"), unchanged: count("unchanged"),
		rejected: count("rejected"), failed: count("failed"), conflicts: count("conflict"),
		unknown: count("unknown"), unattempted: count("pending"),
		errors: rows.filter((row) => !confirmed.has(row.status)).map((row) => ({ row: row.rowNumber, message: row.message || row.action })),
		rows
	};
}

export async function getProductImport(batchId) {
	validateBatchId(batchId);
	await connectProductsDatabase();
	const receipt = await mongoose.connection.db.collection("productImportReceipts").findOne({ _id: batchId });
	if (!receipt) throw new ProductWriteError("Lote no encontrado.", 404, "BATCH_NOT_FOUND");
	return importReport(receipt);
}

export async function runProductImport({ batchId, products, retryRows }, validate) {
	validateBatchId(batchId);
	if (!Array.isArray(products) || products.length < 1 || products.length > 100) {
		throw new ProductWriteError("Envía entre 1 y 100 productos por lote.", 400, "INVALID_BATCH");
	}
	if (retryRows !== undefined && (!Array.isArray(retryRows) || retryRows.some((i) => !Number.isInteger(i) || i < 0 || i >= products.length))) {
		throw new ProductWriteError("retryRows debe indicar posiciones válidas del lote.", 400, "INVALID_RETRY_ROWS");
	}
	await connectProductsDatabase();
	const receipts = mongoose.connection.db.collection("productImportReceipts");
	const model = mongoose.models.Product;
	const digest = hashRows(products);
	const codes = new Set();
	const initial = products.map((input, position) => {
		const base = { position, rowNumber: Number(input?.rowNumber) || position + 1, attempts: 0 };
		try {
			const payload = validate(input);
			if (codes.has(payload.codigo)) throw new Error("El código está duplicado en este lote.");
			codes.add(payload.codigo);
			return { ...base, codigo: payload.codigo, payload, status: "pending" };
		} catch (error) {
			return { ...base, status: "rejected", code: "VALIDATION", message: error.message };
		}
	});
	let fresh = false;
	try {
		await receipts.insertOne({ _id: batchId, digest, rows: initial, createdAt: new Date(), lock: null });
		fresh = true;
	} catch (error) {
		if (error.code !== 11000) throw error;
	}
	let receipt = await receipts.findOne({ _id: batchId });
	if (receipt.digest !== digest) throw new ProductWriteError("batchId ya identifica otro contenido.", 409, "BATCH_CONTENT_MISMATCH");
	if (!fresh && retryRows === undefined) return { report: importReport(receipt), events: [] };
	const token = randomUUID();
	const locked = await receipts.findOneAndUpdate({ _id: batchId, lock: null }, { $set: { lock: token } }, { returnDocument: "after" });
	if (!locked) return { report: importReport(receipt), events: [] };
	const events = [];
	let safeToUnlock = true;
	const setRow = async (position, row) => {
		const result = await receipts.updateOne({ _id: batchId, lock: token }, { $set: { [`rows.${position}`]: row } });
		if (result.matchedCount !== 1) throw new Error("Receipt ownership lost");
	};
	try {
		for (const original of locked.rows) {
			if (!(fresh || retryRows.includes(original.position))) continue;
			if (!["pending", "failed", "conflict"].includes(original.status)) continue;
			const row = { ...original };
			let writing = false;
			try {
				const payload = row.payload;
				const matches = await model.find({ codigo: payload.codigo }).lean();
				if (matches.length > 1) throw new ProductWriteError("Código histórico ambiguo; requiere reconciliación.", 409, "AMBIGUOUS_CODE");
				const current = matches[0];
				let operation;
				let outcome;
				if (current) {
					const patch = Object.fromEntries(Object.entries(payload).filter(([field, value]) =>
						allowed.includes(field) && value !== null && value !== undefined && value !== "" &&
						JSON.stringify(current[field]) !== JSON.stringify(value)
					));
					row.productId = String(current.id);
					if (!Object.keys(patch).length) {
						row.status = "unchanged";
						delete row.code; delete row.message; delete row.httpStatus;
						await setRow(row.position, row);
						continue;
					}
					const version = current.updatedAt ?? null;
					if (version !== null && (!(version instanceof Date) || !Number.isFinite(version.getTime()))) {
						throw new ProductWriteError("Versión persistida inválida; requiere revisión.", 409, "INVALID_STORED_VERSION");
					}
					const next = new Date(Math.max(Date.now(), (version?.getTime() || 0) + 1));
					if (!Number.isFinite(next.getTime())) throw new ProductWriteError("Versión fuera de rango.", 409, "INVALID_STORED_VERSION");
					operation = { updateOne: {
						filter: { id: current.id, updatedAt: version },
						update: { $set: { ...patch, updatedAt: next } }, timestamps: false
					} };
					outcome = "updated";
				} else {
					await requireCodeIndex(model);
					for (const field of ["nombre", "familia", "subfamilia", "precioCosto"]) {
						if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
							throw new ProductWriteError(`El campo ${field} es obligatorio para crear.`, 400, "VALIDATION");
						}
					}
					row.productId = new mongoose.Types.ObjectId().toString();
					operation = { insertOne: { document: {
						...payload, id: row.productId, imagen: "/assets/images/producto-sin-imagen.svg",
						stock: payload.stock ?? null, estado: "disponible", variantes: [], relatedProductIds: []
					} } };
					outcome = "created";
				}
				row.status = "applying";
				row.attempts += 1;
				row.expected = operation.updateOne?.filter.updatedAt ?? null;
				await setRow(row.position, row);
				writing = true;
				const result = await model.bulkWrite([operation], { ordered: true });
				writing = false;
				if (!result || (outcome === "updated" && result.matchedCount !== 1) ||
					(outcome === "created" && result.insertedCount !== 1)) {
					if (outcome === "updated" && result?.matchedCount === 0) {
						row.status = "conflict"; row.code = "VERSION_CONFLICT"; row.httpStatus = 409;
						row.message = "El producto cambió; no se aplicó esta fila.";
					} else {
						row.status = "unknown"; row.code = "UNCONFIRMED_WRITE"; row.httpStatus = 503;
						row.message = "No se confirmó la escritura; no reintentar.";
					}
				} else {
					row.status = outcome;
					delete row.code; delete row.message; delete row.httpStatus;
				}
				try {
					await setRow(row.position, row);
				} catch (error) {
					safeToUnlock = false;
					throw error;
				}
				if (confirmed.has(row.status)) {
					try {
						const product = await model.findOne({ id: row.productId }).lean();
						if (product) events.push({ created: outcome === "created", product });
					} catch {
						console.error("Fila confirmada; no se pudo leer para notificar. Consultar el recibo del lote.");
					}
				}
				if (row.status === "unknown") break;
			} catch (error) {
				if (!safeToUnlock) break;
				const mapped = duplicateCodeError(error);
				const rejectedOperation = error.code === 11000 && error.writeErrors?.length === 1 &&
					error.writeErrors[0].index === 0 && error.writeErrors[0].code === 11000 &&
					!error.result?.getWriteConcernError?.() && !error.hasErrorLabel?.("UnknownTransactionCommitResult");
				const definite = !writing || rejectedOperation;
				row.status = definite ? mapped.status === 409 ? "conflict" : "failed" : "unknown";
				row.httpStatus = definite ? mapped.status || 500 : 503;
				row.code = definite ? mapped.code || (error.code === 11000 ? "DUPLICATE_KEY" : "PERSISTENCE_FAILED") : "WRITE_OUTCOME_UNKNOWN";
				row.message = mapped instanceof ProductWriteError ? mapped.message
					: definite ? "La fila no pudo persistirse." : "Escritura enviada sin confirmación; no reintentar.";
				try { await setRow(row.position, row); } catch { safeToUnlock = false; }
				if (row.status === "unknown" || !safeToUnlock) break;
			}
		}
	} finally {
		if (safeToUnlock) await receipts.updateOne({ _id: batchId, lock: token }, { $set: { lock: null } });
	}
	receipt = await receipts.findOne({ _id: batchId });
	return { report: importReport(receipt), events };
}
