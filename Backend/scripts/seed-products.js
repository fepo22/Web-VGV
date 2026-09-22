import "dotenv/config";
import { getDatabase } from "../config/mongodb.js";
import { products } from "../data/products.sample.js";

const database = await getDatabase();
const collection = database.collection("productos");

await collection.createIndex({ id: 1 }, { unique: true });

await collection.bulkWrite(
  products.map(product => ({
    updateOne: {
      filter: { id: product.id },
      update: { $set: product },
      upsert: true
    }
  }))
);

console.log(`${products.length} productos cargados en MongoDB.`);
process.exitCode = 0;