import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { applySecurity } from "./middlewares/security.middleware.js";

import productsRoutes from "./routes/products.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import cotizarRoutes from "./routes/cotizar.routes.js";

// ===============================
// FIX para __dirname en ES Modules
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// APP
// ===============================
const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === "production";
const CATALOG_URL = process.env.CATALOG_URL || (isProduction ? "" : "http://localhost:5173");

// Middleware global
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Seguridad
applySecurity(app);

// Servir carpeta public
app.use(express.static(path.join(__dirname, "../public")));

// Redirige rutas del catalogo al frontend Svelte en desarrollo
const catalogRoutes = ["/catalogo*", "/producto*", "/carrito*", "/checkout*"];

app.get(catalogRoutes, (req, res) => {
  if (!CATALOG_URL) {
    return res.status(503).send("Catalogo no configurado. Define CATALOG_URL en el servidor.");
  }

  res.redirect(`${CATALOG_URL}${req.originalUrl}`);
});

// ===============================
// RUTAS API
// ===============================
app.use("/api/productos", productsRoutes);
app.use("/api/contacto", contactRoutes);
app.use("/api/cotizar", cotizarRoutes);

// Healthcheck explicito para monitoreo
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "vgv-backend" });
});

// ===============================
// LEVANTAR SERVIDOR
// ===============================
app.listen(PORT, () => {
  console.log(`Servidor VGV SPA escuchando en puerto ${PORT}`);
});
