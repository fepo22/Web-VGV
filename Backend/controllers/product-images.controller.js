import multer from "multer";
import { pipeline } from "node:stream/promises";
import { getProductById } from "../data/products.store.js";
import {
	associateProductImage, deleteUnlinkedImage, getImageBucket, parseImageId, saveProductImage
} from "../data/product-images.store.js";
import { emitProductEvent } from "../realtime/socket.js";
import {
	ImageRequestError, MAX_IMAGE_BYTES, imageProductEvent, imageUrl, parseImageFields, processProductImage
} from "../utils/product-image.js";

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 3, parts: 4, fieldSize: 2048, fieldNameSize: 40 }
}).single("image");

let activeUploads = 0;

export function receiveProductImage(req, res, next) {
	if (!req.is("multipart/form-data")) {
		return res.status(415).json({ error: "Usa multipart/form-data con un archivo image." });
	}
	if (activeUploads >= 2) {
		return res.status(429).json({ error: "Hay dos imágenes en proceso. Reintenta en unos segundos." });
	}
	activeUploads += 1;
	let released = false;
	const release = () => {
		if (!released) activeUploads -= 1;
		released = true;
	};
	res.locals.releaseImageUpload = release;
	res.once("finish", release);
	res.once("close", () => {
		if (!res.locals.processingImage) release();
	});
	upload(req, res, (error) => {
		if (error) {
			const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
			return res.status(status).json({ error: "Multipart inválido: un archivo de hasta 10 MiB y tres campos." });
		}
		res.locals.processingImage = true;
		return next();
	});
}

export async function uploadProductImage(req, res) {
	let storedId;
	let linked = false;
	let associationAttempted = false;
	let associationResolved = false;
	try {
		// Los sanitizadores globales corren antes de multer. Validar aquí tipos y campos
		// y usar exclusivamente valores escalares en filtros, nunca req.body como query.
		const { productId, expectedImage } = parseImageFields(req.body);
		const product = await getProductById(productId);
		if (!product) throw new ImageRequestError("Producto no encontrado.", 404);
		if (product.imagen !== expectedImage) {
			throw new ImageRequestError("La imagen cambió. Recarga el producto y confirma otra vez.", 409);
		}
		const processed = await processProductImage(req.file?.buffer);
		// Host del propio backend como fallback; en despliegues separados fijar PUBLIC_BACKEND_URL.
		const baseUrl = process.env.PUBLIC_BACKEND_URL || `${req.protocol}://${req.get("host")}`;
		imageUrl(baseUrl, "validation");
		storedId = await saveProductImage(processed.buffer, {
			productId, width: processed.width, height: processed.height
		});
		const imagen = imageUrl(baseUrl, storedId.toString());
		associationAttempted = true;
		linked = await associateProductImage(productId, expectedImage, imagen);
		associationResolved = true;
		if (!linked) throw new ImageRequestError("El producto cambió o fue eliminado. Recarga antes de reintentar.", 409);
		const result = imageProductEvent(productId, imagen);
		emitProductEvent("productUpdated", result);
		return res.status(201).json({
			product: result, imageId: storedId.toString(),
			bytes: processed.buffer.length, width: processed.width, height: processed.height
		});
	} catch (error) {
		// Si Mongo perdió la respuesta de una actualización, su commit es incierto.
		// Conservar el archivo en ese caso evita borrar una imagen ya asociada.
		if (storedId && !linked && (!associationAttempted || associationResolved)) {
			await deleteUnlinkedImage(storedId).catch(() => console.error("No se pudo limpiar una imagen sin asociar."));
		}
		if (!(error instanceof ImageRequestError)) console.error("Error almacenando imagen de producto.");
		return res.status(error instanceof ImageRequestError ? error.status : 500).json({
			error: error instanceof ImageRequestError ? error.message : "No se pudo guardar la imagen."
		});
	} finally {
		res.locals.processingImage = false;
		res.locals.releaseImageUpload?.();
	}
}

export async function getPublicProductImage(req, res) {
	const id = parseImageId(req.params.id);
	if (!id) return res.status(404).json({ error: "Imagen no encontrada." });
	try {
		const bucket = await getImageBucket();
		const file = await bucket.find({ _id: id }).next();
		if (!file) return res.status(404).json({ error: "Imagen no encontrada." });
		res.set({
			"Content-Type": "image/webp",
			"Content-Length": String(file.length),
			"Cache-Control": "no-store",
			"Cross-Origin-Resource-Policy": "cross-origin",
			"X-Content-Type-Options": "nosniff"
		});
		await pipeline(bucket.openDownloadStream(id), res);
	} catch {
		if (!res.headersSent && !res.destroyed) return res.status(503).json({ error: "Imagen temporalmente no disponible." });
		if (!res.destroyed) res.destroy();
	}
}