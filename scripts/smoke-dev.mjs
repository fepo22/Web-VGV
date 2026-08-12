import {
  connectProductsDatabase,
  disconnectProductsDatabase,
  listProducts
} from "../Backend/data/products.store.js";

async function runSmoke() {
  const startedAt = Date.now();

  try {
    await connectProductsDatabase();
    const products = await listProducts();

    const elapsed = Date.now() - startedAt;
    console.log(`[smoke] Mongo conectado y lectura OK (${products.length} productos, ${elapsed}ms)`);
    process.exitCode = 0;
  } catch (error) {
    console.error("[smoke] FALLO DB:", error?.message || error);
    process.exitCode = 1;
  } finally {
    try {
      await disconnectProductsDatabase();
    } catch {
      // Ignore disconnect errors in smoke mode.
    }
  }
}

void runSmoke();
