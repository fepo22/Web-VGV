import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
	MAX_IMAGE_BYTES, MAX_OUTPUT_BYTES, imageProductEvent, imageUrl, parseImageFields, processProductImage
} from "../utils/product-image.js";
import { parseImageId } from "../data/product-images.store.js";
import {
	duplicateProductIds, filenameKey, matchImageProducts, validateOriginalImage
} from "../../catalogo-vgv/src/lib/utils/image-matching.js";

test("matching exacto case-insensitive: código, ID y SKU; deduplica por producto", () => {
	const products = [
		{ id: "17", codigo: "ABC-01", variantes: [{ sku: "ABC-01" }, { sku: "VAR-20" }] },
		{ id: "18", codigo: "OTRO", variantes: [{ sku: "VAR-20" }] }
	];
	assert.deepEqual(matchImageProducts("abc-01.JPG", products), [products[0]]);
	assert.deepEqual(matchImageProducts("17.png", products), [products[0]]);
	assert.equal(matchImageProducts("var-20.webp", products).length, 2);
	for (const name of ["ABC.JPG", "ABC-01 (1).jpg", " ABC-01.jpg", "var_20.png", "019.png"]) {
		assert.equal(matchImageProducts(name, products).length, 0);
	}
	assert.equal(filenameKey("SKU.V2.JPEG"), "sku.v2");
	assert.deepEqual([...duplicateProductIds([{ productId: "17" }, { productId: "17" }, { productId: "" }])], ["17"]);
});

test("límites originales cliente y extensiones no admitidas", () => {
	assert.doesNotThrow(() => validateOriginalImage({ name: "17.JPG", size: MAX_IMAGE_BYTES }));
	for (const file of [
		{ name: "17.svg", size: 100 }, { name: "17.gif", size: 100 },
		{ name: "17.png", size: 0 }, { name: "17.png", size: MAX_IMAGE_BYTES + 1 }
	]) assert.throws(() => validateOriginalImage(file));
});

test("campos explícitos, confirmación de overwrite y rechazo de arrays/objetos/inyección", () => {
	assert.deepEqual(parseImageFields({ productId: "17", expectedImage: "" }), { productId: "17", expectedImage: "" });
	assert.throws(() => parseImageFields({ productId: "17", expectedImage: "/old.webp" }), { status: 409 });
	assert.doesNotThrow(() => parseImageFields({ productId: "17", expectedImage: "/old.webp", overwrite: "true" }));
	for (const body of [
		{}, { productId: { $ne: "" }, expectedImage: "" },
		{ productId: ["17"], expectedImage: "" }, { productId: "17", expectedImage: [""] },
		{ productId: "17", expectedImage: "", overwrite: "yes" },
		{ productId: "17", expectedImage: "", $where: "payload" }
	]) assert.throws(() => parseImageFields(body));
});

test("sharp valida bytes reales: rechaza SVG, basura, vacíos, excesos y archivos truncados", async () => {
	const valid = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toBuffer();
	for (const input of [undefined, Buffer.alloc(0), Buffer.alloc(MAX_IMAGE_BYTES + 1),
		Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'),
		Buffer.from("no es un JPEG"), valid.subarray(0, 40)
	]) await assert.rejects(processProductImage(input));
});

test("JPEG/PNG/WebP se convierten a WebP <=1 MiB y <=1600, sin agrandar", async () => {
	for (const format of ["jpeg", "png", "webp"]) {
		const input = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "red" } })[format]().toBuffer();
		const result = await processProductImage(input);
		const metadata = await sharp(result.buffer).metadata();
		assert.equal(metadata.format, "webp");
		assert.equal(result.width, 1600);
		assert.equal(result.height, 1200);
		assert.ok(result.buffer.length <= MAX_OUTPUT_BYTES);
		assert.equal(metadata.exif, undefined);
	}
	const small = await sharp({ create: { width: 20, height: 10, channels: 4, background: "transparent" } }).png().toBuffer();
	const result = await processProductImage(small);
	assert.equal(result.width, 20);
	assert.equal(result.height, 10);
});

test("EXIF orientación se aplica y se elimina", async () => {
	const input = await sharp({ create: { width: 40, height: 20, channels: 3, background: "red" } })
		.withMetadata({ orientation: 6 }).jpeg().toBuffer();
	const result = await processProductImage(input);
	assert.equal(result.width, 20);
	assert.equal(result.height, 40);
	assert.equal((await sharp(result.buffer).metadata()).orientation, undefined);
});

test("límite de píxeles evita descompresión de imágenes gigantes", async () => {
	const input = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: "white" } }).png().toBuffer();
	await assert.rejects(processProductImage(input), { status: 422 });
});

test("URL absoluta, ID estricto y evento sin precioCosto", () => {
	const id = "0123456789abcdef01234567";
	assert.equal(imageUrl("https://backend.example/", id), `https://backend.example/api/product-images/${id}`);
	assert.throws(() => imageUrl("https://secret:password@example.com", id));
	assert.throws(() => imageUrl("file:///tmp", id));
	assert.equal(parseImageId(id).toString(), id);
	for (const invalid of ["123", "../secret", "zzzzzzzzzzzzzzzzzzzzzzzz", "0123456789abcdef0123456g"]) {
		assert.equal(parseImageId(invalid), null);
	}
	assert.deepEqual(imageProductEvent("17", "https://example.com/image"), { id: "17", imagen: "https://example.com/image" });
});