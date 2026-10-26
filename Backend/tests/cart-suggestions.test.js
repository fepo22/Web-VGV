import assert from "node:assert/strict";
import test from "node:test";
import { selectCartSuggestions } from "../../catalogo-vgv/src/lib/utils/cart-suggestions.js";

const catalogo = [
	{ id: "1", categoriaSlug: "tuberias" },
	{ id: "2", categoriaSlug: "tuberias" },
	{ id: "3", categoriaSlug: "tuberias" },
	{ id: "4", categoriaSlug: "tuberias" },
	{ id: "5", categoriaSlug: "tuberias" },
	{ id: "6", categoriaSlug: "grifos" }
];

test("sugerencias usan solo productos reales, excluyen el carrito y respetan la categoría", () => {
	const result = selectCartSuggestions({
		catalogo, items: [{ id: "1", categoriaSlug: "tuberias" }], viewedIds: ["6", "2", "zzz"]
	});
	assert.deepEqual(result.vistos.map((p) => p.id), ["6", "2"]);
	assert.deepEqual(result.complementarios.map((p) => p.id), ["3", "4", "5"]);
});

test("sin catálogo real, error o carrito vacío no se inventan sugerencias", () => {
	const items = [{ id: "1", categoriaSlug: "tuberias" }];
	for (const empty of [[], null, undefined, "x"]) {
		assert.deepEqual(selectCartSuggestions({ catalogo: empty, items, viewedIds: ["1"] }), { vistos: [], complementarios: [] });
	}
	assert.deepEqual(selectCartSuggestions({ catalogo, items: [], viewedIds: ["2"] }), { vistos: [], complementarios: [] });
});

test("ids numéricos y de texto se comparan de forma consistente", () => {
	const result = selectCartSuggestions({ catalogo, items: [{ id: 1, categoriaSlug: "tuberias" }], viewedIds: [1, "2"] });
	assert.deepEqual(result.vistos.map((p) => p.id), ["2"]);
});
