import { MAX_COMPRESSED_BYTES, MAX_DIMENSION, validateOriginalImage } from './image-matching.js';

export async function compressProductImage(file) {
	validateOriginalImage(file);
	const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	const jpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
	const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => signature[index] === value);
	const webp =
		String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' &&
		String.fromCharCode(...signature.slice(8, 12)) === 'WEBP';
	if (!jpeg && !png && !webp)
		throw new Error('Los bytes originales no son JPEG, PNG ni WebP. No se admite SVG.');
	// El navegador aplica orientación EXIF. El servidor vuelve a validar los bytes.
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	try {
		if (bitmap.width * bitmap.height > 40_000_000) {
			throw new Error('La imagen supera 40 megapíxeles.');
		}
		const ratio = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
		canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
		const context = canvas.getContext('2d');
		if (!context) throw new Error('No se pudo crear la vista previa.');
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		for (const quality of [0.82, 0.65, 0.45, 0.25]) {
			const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
			if (!blob || blob.type !== 'image/webp') {
				throw new Error('Este navegador no permite comprimir WebP. Usa un navegador actualizado.');
			}
			if (blob.size <= MAX_COMPRESSED_BYTES) return blob;
		}
		throw new Error('No se pudo comprimir a 1 MiB. Reduce la imagen y vuelve a seleccionarla.');
	} finally {
		bitmap.close();
	}
}
