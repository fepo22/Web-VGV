import {
  createProduct,
  deleteProductById,
  getProductById as findProductById,
  listProducts,
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

function normalizeVariantesInput(value) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("El campo variantes debe ser un arreglo.");
  }

  return value
    .map((variante, index) => {
      const sku = String(variante?.sku ?? `VAR-${index + 1}`).trim();
      const medida = String(variante?.medida ?? "").trim();
      const precio = parsePositiveNumber(variante?.precio ?? 0, `variantes[${index}].precio`);
      const minima = Math.max(1, Math.floor(parsePositiveNumber(variante?.minima ?? 1, `variantes[${index}].minima`)));

      if (!medida) {
        throw new Error(`La variante ${index + 1} debe incluir una medida.`);
      }

      return { sku, medida, precio, minima };
    })
    .filter((variante) => variante.sku && variante.medida);
}

function buildCreatePayload(body = {}) {
  const nombre = String(body.nombre ?? body.name ?? "").trim();
  const codigo = normalizeCodigo(body.codigo ?? body.code ?? body.sku ?? body.id ?? nombre);
  const precio = parsePositiveNumber(body.precio ?? body.price, "precio");
  const descripcion = String(body.descripcion ?? "").trim();
  const categoria = String(body.categoria ?? "").trim() || "Sin categoria";
  const categoriaSlug = String(body.categoriaSlug ?? "").trim() || slugify(categoria) || "sin-categoria";
  const imagen = String(body.imagen ?? body.image ?? "").trim();
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
    precio,
    descripcion,
    categoria,
    categoriaSlug,
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
  const hasPrecio = Object.prototype.hasOwnProperty.call(body, "precio") || Object.prototype.hasOwnProperty.call(body, "price");
  const hasImagen = Object.prototype.hasOwnProperty.call(body, "imagen") || Object.prototype.hasOwnProperty.call(body, "image");
  const hasStock = Object.prototype.hasOwnProperty.call(body, "stock");
  const hasEstado = Object.prototype.hasOwnProperty.call(body, "estado");
  const hasVariantes = Object.prototype.hasOwnProperty.call(body, "variantes");
  const hasDescripcion = Object.prototype.hasOwnProperty.call(body, "descripcion");
  const hasCategoria = Object.prototype.hasOwnProperty.call(body, "categoria");
  const hasCategoriaSlug = Object.prototype.hasOwnProperty.call(body, "categoriaSlug");

  const hasAnyField =
    hasCodigo ||
    hasNombre ||
    hasPrecio ||
    hasImagen ||
    hasStock ||
    hasEstado ||
    hasVariantes ||
    hasDescripcion ||
    hasCategoria ||
    hasCategoriaSlug;

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

  if (hasPrecio) {
    patch.precio = parsePositiveNumber(body.precio ?? body.price, "precio");
  }

  if (hasImagen) {
    const imagen = String(body.imagen ?? body.image ?? "").trim();
    if (!imagen) {
      throw new Error("La imagen es obligatoria.");
    }
    patch.imagen = imagen;
  }

  if (hasDescripcion) {
    patch.descripcion = String(body.descripcion ?? "");
  }

  if (hasVariantes) {
    patch.variantes = normalizeVariantesInput(body.variantes) ?? currentProduct.variantes;
  }

  if (hasCategoria) {
    patch.categoria = String(body.categoria ?? "").trim() || currentProduct.categoria;
  }

  if (hasCategoriaSlug) {
    patch.categoriaSlug = String(body.categoriaSlug ?? "").trim() || currentProduct.categoriaSlug;
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
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener los productos." });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    return res.json(product);
  } catch (error) {
    return res.status(500).json({ error: "No se pudo obtener el producto." });
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
