import {
  createProduct,
  deleteProductById,
  getProductById as findProductById,
  listProducts,
  upsertProductByCode,
  updateProductById
} from "../data/products.store.js";
import { emitProductEvent } from "../realtime/socket.js";

function normalizeEstado(input) {
  const estado = String(input ?? "disponible").toLowerCase().trim();
  if (estado === "sin stock" || estado === "sin_stock" || estado === "sin-stock") {
    return "sin stock";
  }

  return "disponible";
}

function normalizeCodigo(value) {
  const codigo = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "");

  if (!codigo) {
    throw new Error("El codigo es obligatorio.");
  }

  return codigo;
}

function parsePositiveNumber(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`El campo ${fieldName} debe ser un número válido mayor o igual a 0.`);
  }

  return parsed;
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
      const sku = String(variante?.sku ?? `VAR-${index + 1}`).trim();
      const medida = String(variante?.medida ?? "").trim();
      const minima = Math.max(1, Math.floor(parsePositiveNumber(variante?.minima ?? 1, `variantes[${index}].minima`)));

      if (!medida) {
        throw new Error(`La variante ${index + 1} debe incluir una medida.`);
      }

      return { sku, medida, minima };
    })
    .filter((variante) => variante.sku && variante.medida);
}

function buildCreatePayload(body = {}) {
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
  const stock = parsePositiveNumber(body.stock, "stock");
  const estado = normalizeEstado(body.estado);
  const variantes = normalizeVariantesInput(body.variantes);

  if (!nombre) {
    throw new Error("El nombre es obligatorio.");
  }

  if (!imagen) {
    throw new Error("La imagen es obligatoria.");
  }

  if (estado === "disponible" && stock <= 0) {
    throw new Error("Un producto disponible debe tener stock mayor a 0.");
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
    stock: estado === "sin stock" ? 0 : stock,
    estado
  };
}

function buildUpdatePayload(body = {}, currentProduct) {
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
    hasPrecioCosto;

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

  if (hasFamilia || hasFamiliaSlug || hasSubfamilia || hasSubfamiliaSlug) {
    patch.familia = String(body.familia ?? currentProduct.familia ?? currentProduct.categoria ?? "Sin categoria").trim();
    patch.familiaSlug = String(body.familiaSlug ?? currentProduct.familiaSlug ?? currentProduct.categoriaSlug ?? slugify(patch.familia)).trim();
    patch.subfamilia = String(body.subfamilia ?? currentProduct.subfamilia ?? "").trim();
    patch.subfamiliaSlug = String(body.subfamiliaSlug ?? currentProduct.subfamiliaSlug ?? slugify(patch.subfamilia)).trim();
    patch.categoria = String(body.categoria ?? "").trim();
    patch.categoriaSlug = String(body.categoriaSlug ?? "").trim() || slugify(patch.categoria);
  } else if (hasCategoria || hasCategoriaSlug) {
    patch.familia = hasCategoria
      ? String(body.categoria ?? "").trim() || currentProduct.familia || currentProduct.categoria
      : currentProduct.familia || currentProduct.categoria;
    patch.familiaSlug = String(body.categoriaSlug ?? "").trim() || currentProduct.familiaSlug || slugify(patch.familia);
    patch.subfamilia = "";
    patch.subfamiliaSlug = "";
    patch.categoria = "";
    patch.categoriaSlug = "";
  }

  if (hasStock) {
    patch.stock = parsePositiveNumber(body.stock, "stock");
  }

  if (hasEstado) {
    patch.estado = normalizeEstado(body.estado);
  }

  if (hasStock && !hasEstado) {
    patch.estado = patch.stock > 0 ? "disponible" : "sin stock";
  }

  if (patch.estado === "sin stock") {
    patch.stock = 0;
  }

  if (patch.estado === "disponible" && patch.stock === 0) {
    throw new Error("Un producto disponible debe tener stock mayor a 0.");
  }

  if (!hasStock && hasEstado && patch.estado === "disponible") {
    patch.stock = currentProduct.stock > 0 ? currentProduct.stock : 1;
  }

  return patch;
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

    return res.json(withoutCost(product));
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
  const rows = req.body?.products;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 10) {
    return res.status(400).json({ error: "Envía entre 1 y 10 productos por lote." });
  }

  const validRows = [];
  const errors = [];
  const codesInBatch = new Set();

  for (const [index, row] of rows.entries()) {
    const rowNumber = Number(row?.rowNumber) || index + 1;
    try {
      const codigo = normalizeCodigo(row?.codigo);
      const nombre = String(row?.nombre ?? "").trim();
      const familia = String(row?.familia ?? "").trim();
      const subfamilia = String(row?.subfamilia ?? "").trim();
      const categoria = String(row?.categoria ?? "").trim();
      const precioCosto = parsePositiveNumber(row?.precioCosto, "precio costo");
      if (!nombre || !familia || !subfamilia) {
        throw new Error("Nombre, familia y subfamilia son obligatorios.");
      }
      if (codesInBatch.has(codigo)) throw new Error("El código está duplicado en este lote.");
      codesInBatch.add(codigo);
      validRows.push({
        rowNumber,
        payload: {
          codigo,
          nombre,
          familia,
          familiaSlug: String(row?.familiaSlug ?? slugify(familia)).trim() || slugify(familia),
          subfamilia,
          subfamiliaSlug: String(row?.subfamiliaSlug ?? slugify(subfamilia)).trim() || slugify(subfamilia),
          categoria,
          categoriaSlug: String(row?.categoriaSlug ?? slugify(categoria)).trim() || slugify(categoria),
          precioCosto,
          imagen: "/assets/images/producto-sin-imagen.svg",
          stock: 0,
          estado: "sin stock"
        }
      });
    } catch (error) {
      errors.push({ row: rowNumber, message: error.message || "Fila inválida." });
    }
  }

  let created = 0;
  let updated = 0;
  try {
    for (const { payload } of validRows) {
      const result = await upsertProductByCode(payload);
      if (result.created) {
        created += 1;
        emitProductEvent("productAdded", result.product);
      } else {
        updated += 1;
        emitProductEvent("productUpdated", result.product);
      }
    }
    return res.json({ created, updated, errors });
  } catch (error) {
    console.error("Error importando productos:", error.message);
    return res.status(500).json({ error: "No se pudo completar la importación." });
  }
};

export const createProductController = async (req, res) => {
  try {
    const payload = buildCreatePayload(req.body);
    const created = await createProduct(payload);

    emitProductEvent("productAdded", created);

    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Datos inválidos." });
  }
};

export const updateProductController = async (req, res) => {
  try {
    const currentProduct = await findProductById(req.params.id);
    if (!currentProduct) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const patch = buildUpdatePayload(req.body, currentProduct);
    const updated = await updateProductById(req.params.id, patch);

    emitProductEvent("productUpdated", updated);

    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Datos inválidos." });
  }
};

export const deleteProductController = async (req, res) => {
  try {
    const deleted = await deleteProductById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    emitProductEvent("productDeleted", {
      id: deleted.id,
      deletedAt: new Date().toISOString()
    });

    return res.json({ ok: true, deleted });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo eliminar el producto." });
  }
};
