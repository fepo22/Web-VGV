import {
  createProduct,
  deleteProductById,
  getProductById as findProductById,
  getProductsByIds,
  listProducts,
  updateProductById
} from "../data/products.store.js";
import { emitProductEvent } from "../realtime/socket.js";
import { validateRelatedProductIds } from "../utils/related-products.js";
import { canonicalProductCode, duplicateCodeError } from "../utils/product-code.js";
import { runProductImport, getProductImport } from "../data/product-imports.store.js";

function normalizeEstado(input) {
  const estado = String(input ?? "disponible").toLowerCase().trim();
  if (estado === "sin stock" || estado === "sin_stock" || estado === "sin-stock") {
    return "sin stock";
  }

  return "disponible";
}

function normalizeCodigo(value) {
  return canonicalProductCode(value);
}

function parsePositiveNumber(value, fieldName) {
  if ((typeof value !== "number" && typeof value !== "string") ||
      String(value).trim() === "") {
    throw new Error(`El campo ${fieldName} debe ser un número válido mayor o igual a 0.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`El campo ${fieldName} debe ser un número válido mayor o igual a 0.`);
  }

  return parsed;
}

function parseStock(value) {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) return null;
  return parsePositiveNumber(value, "stock");
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function withoutCost(product) {
  const publicProduct = { ...product };
  delete publicProduct.precioCosto;
  return publicProduct;
}

function normalizeVariantesInput(value) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("El campo variantes debe ser un arreglo.");
  }

  return value
    .map((variante, index) => {
      const sku = String(variante?.sku ?? "").trim();
      const medida = String(variante?.medida ?? "").trim();
      const minima = Math.max(1, Math.floor(parsePositiveNumber(variante?.minima ?? 1, `variantes[${index}].minima`)));

      if (!medida) {
        throw new Error(`La variante ${index + 1} debe incluir una medida.`);
      }

      return { sku, medida, minima };
    })
    .filter((variante) => variante.medida);
}

export function buildCreatePayload(body = {}) {
  const nombre = String(body.nombre ?? body.name ?? "").trim();
  const codigo = normalizeCodigo(body.codigo ?? body.code ?? body.sku ?? body.id ?? nombre);
  const descripcion = String(body.descripcion ?? "").trim();
  const familia = String(body.familia ?? body.categoria ?? "").trim() || "Sin categoria";
  const familiaSlug = String(body.familiaSlug ?? body.categoriaSlug ?? "").trim() || slugify(familia) || "sin-categoria";
  const subfamilia = String(body.subfamilia ?? "").trim();
  const subfamiliaSlug = String(body.subfamiliaSlug ?? "").trim() || slugify(subfamilia);
  const categoria = body.familia ? String(body.categoria ?? "").trim() : "";
  const categoriaSlug = body.familia ? String(body.categoriaSlug ?? "").trim() || slugify(categoria) : "";
  const imagen = String(body.imagen ?? body.image ?? "").trim();
	const precioCosto = parsePositiveNumber(body.precioCosto ?? 0, "precioCosto");
  const hasStock = Object.prototype.hasOwnProperty.call(body, "stock");
  const stock = hasStock ? parseStock(body.stock) : undefined;
  const estado = normalizeEstado(body.estado);
  const variantes = normalizeVariantesInput(body.variantes);

  if (!nombre) {
    throw new Error("El nombre es obligatorio.");
  }

  if (!imagen) {
    throw new Error("La imagen es obligatoria.");
  }

  return {
    codigo,
    nombre,
    descripcion,
    familia,
    familiaSlug,
    subfamilia,
    subfamiliaSlug,
    categoria,
    categoriaSlug,
    precioCosto,
    imagen,
    ...(variantes ? { variantes } : {}),
    ...(hasStock ? { stock } : {}),
    estado
  };
}

export function buildUpdatePayload(body = {}, currentProduct) {
  const hasCodigo =
    Object.prototype.hasOwnProperty.call(body, "codigo") ||
    Object.prototype.hasOwnProperty.call(body, "code") ||
    Object.prototype.hasOwnProperty.call(body, "sku");
  const hasNombre = Object.prototype.hasOwnProperty.call(body, "nombre") || Object.prototype.hasOwnProperty.call(body, "name");
  const hasImagen = Object.prototype.hasOwnProperty.call(body, "imagen") || Object.prototype.hasOwnProperty.call(body, "image");
  const hasStock = Object.prototype.hasOwnProperty.call(body, "stock");
  const hasEstado = Object.prototype.hasOwnProperty.call(body, "estado");
  const hasVariantes = Object.prototype.hasOwnProperty.call(body, "variantes");
  const hasDescripcion = Object.prototype.hasOwnProperty.call(body, "descripcion");
  const hasFamilia = Object.prototype.hasOwnProperty.call(body, "familia");
  const hasFamiliaSlug = Object.prototype.hasOwnProperty.call(body, "familiaSlug");
  const hasSubfamilia = Object.prototype.hasOwnProperty.call(body, "subfamilia");
  const hasSubfamiliaSlug = Object.prototype.hasOwnProperty.call(body, "subfamiliaSlug");
  const hasCategoria = Object.prototype.hasOwnProperty.call(body, "categoria");
  const hasCategoriaSlug = Object.prototype.hasOwnProperty.call(body, "categoriaSlug");
  const hasPrecioCosto = Object.prototype.hasOwnProperty.call(body, "precioCosto");
  const hasRelatedProducts = Object.prototype.hasOwnProperty.call(body, "relatedProductIds");

  const hasAnyField =
    hasCodigo ||
    hasNombre ||
    hasImagen ||
    hasStock ||
    hasEstado ||
    hasVariantes ||
    hasDescripcion ||
    hasFamilia ||
    hasFamiliaSlug ||
    hasSubfamilia ||
    hasSubfamiliaSlug ||
    hasCategoria ||
    hasCategoriaSlug ||
    hasPrecioCosto ||
    hasRelatedProducts;

  if (!hasAnyField) {
    throw new Error("Debes enviar datos para actualizar el producto.");
  }

  const patch = {};

  if (hasCodigo) {
    patch.codigo = normalizeCodigo(body.codigo ?? body.code ?? body.sku);
  }

  if (hasNombre) {
    const nombre = String(body.nombre ?? body.name ?? "").trim();
    if (!nombre) {
      throw new Error("El nombre es obligatorio.");
    }
    patch.nombre = nombre;
  }

  if (hasImagen) {
    const imagen = String(body.imagen ?? body.image ?? "").trim();
    if (!imagen) {
      throw new Error("La imagen es obligatoria.");
    }
    patch.imagen = imagen;
  }

  if (hasPrecioCosto) {
    patch.precioCosto = parsePositiveNumber(body.precioCosto, "precioCosto");
  }

  if (hasDescripcion) {
    patch.descripcion = String(body.descripcion ?? "");
  }

  if (hasVariantes) {
    patch.variantes = normalizeVariantesInput(body.variantes) ?? currentProduct.variantes;
  }

  for (const [field, hasValue, hasSlug] of [
    ["familia", hasFamilia, hasFamiliaSlug],
    ["subfamilia", hasSubfamilia, hasSubfamiliaSlug],
    ["categoria", hasCategoria, hasCategoriaSlug]
  ]) {
    if (hasValue) patch[field] = String(body[field] ?? "").trim();
    if (hasSlug || hasValue) {
      patch[`${field}Slug`] = hasSlug
        ? String(body[`${field}Slug`] ?? "").trim()
        : slugify(patch[field]);
    }
  }

  if (hasStock) {
    patch.stock = parseStock(body.stock);
  }

  if (hasEstado) {
    patch.estado = normalizeEstado(body.estado);
  }

  return patch;
}

export function buildImportPayload(row = {}) {
  const rawCode = row?.codigo;
  if ((typeof rawCode !== "string" && typeof rawCode !== "number") ||
      !/^[A-Z0-9_-]+$/.test(String(rawCode).trim().toUpperCase().replace(/\s+/g, "-"))) {
    throw new Error("El codigo es obligatorio y debe identificar el producto sin caracteres descartados.");
  }
  const codigo = normalizeCodigo(rawCode);
  if (codigo.length > 80) throw new Error("El código admite hasta 80 caracteres.");
  const payload = { codigo };
  const optionalTextFields = [
    ["nombre", 200],
    ["familia"],
    ["subfamilia"],
    ["categoria"]
  ];

  for (const [field, maxLength] of optionalTextFields) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) continue;
    const value = String(row[field] ?? "").trim();
    if (!value) continue;
    if (maxLength && value.length > maxLength) {
      throw new Error("El nombre admite hasta 200 caracteres.");
    }
    payload[field] = value;
  }

  for (const field of ["familia", "subfamilia", "categoria"]) {
    const slugField = `${field}Slug`;
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      const slug = String(row?.[slugField] ?? slugify(payload[field])).trim() || slugify(payload[field]);
      payload[slugField] = slug;
    }
  }

  if (Object.prototype.hasOwnProperty.call(row, "precioCosto") &&
      row.precioCosto !== null &&
      String(row.precioCosto).trim() !== "") {
    payload.precioCosto = parsePositiveNumber(row.precioCosto, "precio costo");
  }
  if (Object.prototype.hasOwnProperty.call(row, "stock") &&
      row.stock !== undefined &&
      row.stock !== null &&
      !(typeof row.stock === "string" && row.stock.trim() === "")) {
    if (typeof row.stock !== "number" &&
        (typeof row.stock !== "string" || !/^\d+(?:\.\d+)?$/.test(row.stock.trim()))) {
      throw new Error("El campo stock debe ser un número válido mayor o igual a 0.");
    }
    payload.stock = parseStock(row.stock);
  }
  return payload;
}

export const getProducts = async (req, res) => {
  try {
    const products = await listProducts();
    return res.json(products.map(withoutCost));
  } catch (error) {
    console.error("Error consultando productos:", error.message);
    return res.status(500).json({ error: "No se pudieron obtener los productos." });
  }
};

export const getAdminProducts = async (req, res) => {
  try {
    return res.json(await listProducts());
  } catch (error) {
    console.error("Error consultando productos:", error.message);
    return res.status(500).json({ error: "No se pudieron obtener los productos." });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const relatedProducts = await getProductsByIds(product.relatedProductIds || []);
    return res.json({ ...withoutCost(product), relatedProducts: relatedProducts.map(withoutCost) });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo obtener el producto." });
  }
};

export const getAdminProductById = async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });
    return res.json(product);
  } catch {
    return res.status(500).json({ error: "No se pudo obtener el producto." });
  }
};

export const bulkImportProductsController = async (req, res) => {
  try {
    const { report, events } = await runProductImport(req.body ?? {}, buildImportPayload);
    for (const result of events) {
      emitProductEvent(result.created ? "productAdded" : "productUpdated", withoutCost(result.product));
    }
    return res.status(report.complete ? 200 : 207).json(report);
  } catch (error) {
    console.error("Importación no completada; consultar su batchId antes de reintentar.");
    return res.status(error.status || 503).json({
      error: error.status ? error.message : "No se pudo confirmar el lote. Consulta su batchId; no lo reenvíes con otra identidad.",
      code: error.status ? error.code : "BATCH_OUTCOME_UNKNOWN",
      batchId: req.body?.batchId
    });
  }
};

export const getProductImportController = async (req, res) => {
  try {
    return res.json(await getProductImport(req.params.batchId));
  } catch (error) {
    return res.status(error.status || 503).json({
      error: error.status ? error.message : "No se pudo consultar el lote.",
      code: error.code || "BATCH_UNAVAILABLE"
    });
  }
};

export const createProductController = async (req, res) => {
  try {
    const payload = buildCreatePayload(req.body);
    payload.relatedProductIds = await validateRelatedProductIds(
      req.body?.relatedProductIds ?? [], undefined, getProductsByIds
    );
    const created = await createProduct(payload);

    emitProductEvent("productAdded", withoutCost(created));

    return res.status(201).json(created);
  } catch (error) {
    const mapped = duplicateCodeError(error);
    return res.status(mapped.status || 400).json({ error: mapped.message || "Datos inválidos.", code: mapped.code });
  }
};

const ISO_VERSION = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

// Devuelve { date } (null = sin versión previa) o { status, error } si falta o es inválida.
function parseExpectedVersion(body) {
  if (!Object.prototype.hasOwnProperty.call(body ?? {}, "_expectedUpdatedAt")) {
    return {
      status: 428,
      error: "La versión del producto es obligatoria. Actualiza la ficha e inténtalo nuevamente."
    };
  }
  const expectedVersion = body._expectedUpdatedAt;
  if (expectedVersion === null) return { date: null };
  const parts = typeof expectedVersion === "string" ? ISO_VERSION.exec(expectedVersion) : null;
  const invalid = { status: 400, error: "La versión del producto no es válida." };
  if (!parts) return invalid;
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const date = new Date(expectedVersion);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] ||
      hour > 23 || minute > 59 || second > 59 || !Number.isFinite(date.getTime())) {
    return invalid;
  }
  return { date };
}

export const updateProductController = async (req, res) => {
  try {
    const version = parseExpectedVersion(req.body);
    if (version.error) return res.status(version.status).json({ error: version.error });
    const expectedUpdatedAt = version.date;

    const currentProduct = await findProductById(req.params.id);
    if (!currentProduct) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const patch = buildUpdatePayload(req.body, currentProduct);
    if (Object.prototype.hasOwnProperty.call(req.body, "relatedProductIds")) {
      patch.relatedProductIds = await validateRelatedProductIds(
        req.body.relatedProductIds, currentProduct.id, getProductsByIds
      );
    }
    const updated = await updateProductById(req.params.id, patch, expectedUpdatedAt);
    if (!updated) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    emitProductEvent("productUpdated", withoutCost(updated));

    return res.json(updated);
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ error: error.message, code: error.code });
    return res.status(400).json({ error: error.message || "Datos inválidos." });
  }
};

export const deleteProductController = async (req, res) => {
  try {
    const version = parseExpectedVersion(req.body);
    if (version.error) return res.status(version.status).json({ error: version.error });
    const deleted = await deleteProductById(req.params.id, version.date);
    if (!deleted) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    emitProductEvent("productDeleted", {
      id: deleted.id,
      deletedAt: new Date().toISOString()
    });

    return res.json({ ok: true, deleted });
  } catch (error) {
    if (error?.code === "REFERENCE_CLEANUP_PENDING") {
      emitProductEvent("productDeleted", {
        id: error.deleted.id,
        deletedAt: new Date().toISOString()
      });
      return res.json({
        ok: true,
        deleted: error.deleted,
        referencesCleanup: "pending",
        warning: error.message
      });
    }
    if (error?.status === 409) return res.status(409).json({ error: error.message });
    return res.status(500).json({ error: "No se pudo eliminar el producto." });
  }
};
