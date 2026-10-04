import sharp from "sharp";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 1600;
export const MAX_IMAGE_PIXELS = 40_000_000;

export class ImageRequestError extends Error {
	constructor(message, status = 400) {
		super(message);
		this.status = status;
	}
}

export function parseImageFields(body = {}) {
	const allowed = ["productId", "expectedImage", "overwrite"];
	if (Object.keys(body).some((key) => !allowed.includes(key))) {
		throw new ImageRequestError("Campos multipart no permitidos.");
	}
	const { productId, expectedImage, overwrite } = body;
	if (typeof productId !== "string" || !productId.trim() || productId.length > 200) {
		throw new ImageRequestError("Debes indicar el ID explícito del producto.");
	}
	if (typeof expectedImage !== "string" || expectedImage.length > 2048) {
		throw new ImageRequestError("Debes indicar expectedImage, incluso si está vacío.");
	}
	if (overwrite !== undefined && !["true", "false"].includes(overwrite)) {
		throw new ImageRequestError("Confirmación de sobrescritura inválida.");
	}
	if (expectedImage && overwrite !== "true") {
		throw new ImageRequestError("Confirma la sobrescritura de la imagen actual.", 409);
	}
	return { productId: productId.trim(), expectedImage };
}

export async function processProductImage(buffer) {
	if (!Buffer.isBuffer(buffer) || !buffer.length) {
		throw new ImageRequestError("Selecciona una imagen.");
	}
	if (buffer.length > MAX_IMAGE_BYTES) {
		throw new ImageRequestError("La imagen original supera 10 MiB.", 413);
	}
	try {
		const options = { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" };
		const metadata = await sharp(buffer, options).metadata();
		if (!["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages || 1) > 1) {
			throw new ImageRequestError("Solo JPEG, PNG y WebP estáticos; SVG y animaciones no admitidos.");
		}
		// rotate aplica EXIF; no se conserva metadata ni el nombre original.
		for (const quality of [82, 65, 45, 25]) {
			const { data, info } = await sharp(buffer, options)
				.rotate()
				.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true })
				.webp({ quality, effort: 4 })
				.toBuffer({ resolveWithObject: true });
			if (data.length <= MAX_OUTPUT_BYTES) {
				return { buffer: data, width: info.width, height: info.height };
			}
		}
		throw new ImageRequestError("No se pudo comprimir la imagen a 1 MiB.", 422);
	} catch (error) {
		if (error instanceof ImageRequestError) throw error;
		throw new ImageRequestError("Imagen corrupta, no admitida o superior a 40 megapíxeles.", 422);
	}
}

export function imageUrl(baseUrl, id) {
	const base = new URL(baseUrl);
	if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
		throw new Error("PUBLIC_BACKEND_URL debe ser una URL HTTP(S) sin credenciales.");
	}
	return `${base.origin}/api/product-images/${id}`;
}

export function imageProductEvent(productId, imagen) {
	// Evento mínimo: jamás incluye precioCosto ni metadata privada.
	return { id: String(productId), imagen };
}