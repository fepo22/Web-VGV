import mongoose from "mongoose";
import { ProductWriteError } from "./product-code.js";

export function managedImageId(value) {
	let pathname;
	try {
		pathname = decodeURIComponent(new URL(String(value ?? ""), "http://local.invalid").pathname);
	} catch {
		throw new ProductWriteError("La referencia de imagen no es válida.", 400, "INVALID_IMAGE_REFERENCE");
	}
	const match = pathname.match(/^\/api\/product-images\/([a-f\d]{24})\/?$/i);
	return match ? new mongoose.Types.ObjectId(match[1]) : null;
}

export async function protectImageReference(value) {
	const id = managedImageId(value);
	if (!id) return;
	const files = mongoose.connection.db.collection("productImages.files");
	const protectedFile = await files.findOneAndUpdate(
		{ _id: id, "metadata.e0Lifecycle.state": { $in: ["private", "protected"] } },
		{ $set: { "metadata.e0Lifecycle.state": "protected" } },
		{ returnDocument: "after" }
	);
	if (protectedFile) return;
	// Legacy files are retained, never made eligible for automatic cleanup.
	const legacy = await files.findOne({ _id: id, "metadata.e0Lifecycle": { $exists: false } });
	if (legacy) return;
	throw new ProductWriteError("La imagen no existe o está en eliminación; no se guardó la referencia.", 409, "IMAGE_UNAVAILABLE");
}
