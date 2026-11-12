import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemapXml, escapeXml } from "../controllers/sitemap.controller.js";

test("sitemap incluye páginas estáticas y recorta la barra final", () => {
  const xml = buildSitemapXml("https://example.com/", []);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/catalogo<\/loc>/);
  assert.doesNotMatch(xml, /\.com\/\/catalogo/);
});

test("sitemap codifica ids de producto", () => {
  const xml = buildSitemapXml("https://example.com", ["a b"]);
  assert.match(xml, /\/producto\/a%20b<\/loc>/);
});

test("escapeXml escapa caracteres especiales", () => {
  assert.equal(escapeXml("a&b<c>"), "a&#38;b&#60;c&#62;");
});
