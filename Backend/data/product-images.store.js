import mongoose from "mongoose";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { connectProductsDatabase, getProductById, updateProductById } from "./products.store.js";
import { managedImageId } from "../utils/image-lifecycle.js";
import { ProductWriteError } from "../utils/product-code.js";

const uploadOwners = new Map();

export async function getImageBucket() {
	await connectProductsDatabase();
	return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "productImages" });
}

export function parseImageId(value) {
	return /^[a-f\d]{24}$/i.test(String(value)) ? new mongoose.Types.ObjectId(value) : null;
}

export async function saveProductImage(buffer, metadata) {
	const bucket = await getImageBucket();
	const owner = randomUUID();
	const upload = bucket.openUploadStream("product.webp", {
		contentType: "image/webp",
		metadata: { ...metadata, e0Lifecycle: { owner, state: "private" } }
	});
	try {
		await pipeline(Readable.from([buffer]), upload);
		uploadOwners.set(String(upload.id), owner);
		return upload.id;
	} catch (error) {
		await upload.abort().catch(() => {});
		throw error;
	}
}

export async function deleteUnlinkedImage(id) {
	await connectProductsDatabase();
	const owner = uploadOwners.get(String(id));
	if (!owner) throw new ProductWriteError("No se acreditó propiedad del upload privado.", 409, "IMAGE_NOT_OWNED");
	const db = mongoose.connection.db;
	const files = db.collection("productImages.files");
	const claim = randomUUID();
	const file = await files.findOneAndUpdate(
		{ _id: id, "metadata.e0Lifecycle.owner": owner, "metadata.e0Lifecycle.state": "private" },
		{ $set: { "metadata.e0Lifecycle.state": "deleting", "metadata.e0Lifecycle.claim": claim } },
		{ returnDocument: "after" }
	);
	if (!file) {
		uploadOwners.delete(String(id));
		throw new ProductWriteError("La imagen está protegida o su limpieza ya fue reclamada.", 409, "IMAGE_PROTECTED");
	}
	const products = await mongoose.models.Product.find({}, { imagen: 1 }).lean();
	if (products.some((product) => managedImageId(product.imagen)?.equals(id))) {
		await files.updateOne({ _id: id, "metadata.e0Lifecycle.claim": claim }, {
			$set: { "metadata.e0Lifecycle.state": "protected" }
		});
		uploadOwners.delete(String(id));
		throw new ProductWriteError("La imagen sigue referenciada y se conservará.", 409, "IMAGE_REFERENCED");
	}
	// Keep the deletion marker until chunks are gone. Failed cleanup cannot be republished.
	await db.collection("productImages.chunks").deleteMany({ files_id: id });
	const removed = await files.deleteOne({ _id: id, "metadata.e0Lifecycle.claim": claim, "metadata.e0Lifecycle.state": "deleting" });
	if (removed.deletedCount !== 1) throw new ProductWriteError("No se confirmó la limpieza de imagen.", 503, "IMAGE_CLEANUP_UNKNOWN");
	uploadOwners.delete(String(id));
}

export async function associateProductImage(productId, expectedImage, imagen) {
	const product = await getProductById(productId);
	if (!product || product.imagen !== expectedImage) return false;
	try {
		return Boolean(await updateProductById(productId, { imagen }, product.updatedAt));
	} catch (error) {
		if (error?.status === 409) return false;
		throw error;
	} finally {
		const id = managedImageId(imagen);
		if (id) uploadOwners.delete(String(id));
	}
}