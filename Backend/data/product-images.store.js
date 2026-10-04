import mongoose from "mongoose";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { connectProductsDatabase } from "./products.store.js";

export async function getImageBucket() {
	await connectProductsDatabase();
	return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "productImages" });
}

export function parseImageId(value) {
	return /^[a-f\d]{24}$/i.test(String(value)) ? new mongoose.Types.ObjectId(value) : null;
}

export async function saveProductImage(buffer, metadata) {
	const bucket = await getImageBucket();
	const upload = bucket.openUploadStream("product.webp", {
		contentType: "image/webp",
		metadata
	});
	try {
		await pipeline(Readable.from([buffer]), upload);
		return upload.id;
	} catch (error) {
		await upload.abort().catch(() => {});
		throw error;
	}
}

export async function deleteUnlinkedImage(id) {
	const bucket = await getImageBucket();
	await bucket.delete(id);
}

export async function associateProductImage(productId, expectedImage, imagen) {
	await connectProductsDatabase();
	// Solo cambia imagen: no normaliza ni reescribe relaciones, variantes o costo.
	const result = await mongoose.models.Product.updateOne(
		{ id: productId, imagen: expectedImage },
		{ $set: { imagen } },
		{ runValidators: true }
	);
	return result.matchedCount === 1;
}