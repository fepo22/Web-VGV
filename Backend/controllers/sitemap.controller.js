import { listProducts } from "../data/products.store.js";

const STATIC_PATHS = ["/", "/catalogo", "/quienes-somos", "/contacto"];

export const escapeXml = (value) =>
  String(value).replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function buildSitemapXml(siteUrl, productIds = []) {
  const base = String(siteUrl).replace(/\/+$/, "");
  const paths = [
    ...STATIC_PATHS,
    ...productIds.map((id) => `/producto/${encodeURIComponent(id)}`)
  ];
  const urls = paths.map((p) => `  <url><loc>${escapeXml(base + p)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export const getSitemap = async (req, res) => {
  const siteUrl = process.env.SITE_URL || "https://web-vgv.vercel.app";
  let ids = [];
  try {
    const products = await listProducts();
    ids = products.map((p) => p?.id).filter((id) => id !== undefined && id !== null);
  } catch (error) {
    console.error("Error generando sitemap:", error.message);
  }
  res.set({
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=0, s-maxage=3600"
  });
  return res.send(buildSitemapXml(siteUrl, ids));
};
