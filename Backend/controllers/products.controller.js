import { products } from "../data/products.sample.js";
import { getDatabase, isMongoConfigured } from "../config/mongodb.js";

export const getProducts = async (req, res) => {
  if (!isMongoConfigured) {
    return res.json(products);
  }

  try {
    const database = await getDatabase();
    const databaseProducts = await database.collection("productos")
      .find({}, { projection: { _id: 0 } })
      .sort({ id: 1 })
      .toArray();

    res.json(databaseProducts.length ? databaseProducts : products);
  } catch (error) {
    console.error("Error consultando productos en MongoDB:", error.message);
    res.status(503).json({ error: "No se pudo consultar el catalogo" });
  }
};

export const getProductById = async (req, res) => {
  if (isMongoConfigured) {
    try {
      const database = await getDatabase();
      const product = await database.collection("productos").findOne(
        { id: Number(req.params.id) },
        { projection: { _id: 0 } }
      );

      if (!product) return res.status(404).json({ error: "Producto no encontrado" });
      return res.json(product);
    } catch (error) {
      console.error("Error consultando producto en MongoDB:", error.message);
      return res.status(503).json({ error: "No se pudo consultar el producto" });
    }
  }

  const id = Number(req.params.id);
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ error: "Producto no encontrado" });
  res.json(product);
};
