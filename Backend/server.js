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
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:5173";

// Middleware global
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Seguridad
applySecurity(app);

// Servir carpeta public
app.use(express.static(path.join(__dirname, "../public")));

// Redirige rutas de catalogo al frontend Svelte en desarrollo
app.get("/catalogo*", (req, res) => {
  res.redirect(`${CATALOG_URL}${req.originalUrl}`);
});

// ===============================
// RUTAS API
// ===============================
app.use("/api/productos", productsRoutes);
app.use("/api/contacto", contactRoutes);
app.use("/api/cotizar", cotizarRoutes);

// Ruta base
app.get("/", (req, res) => {
  res.json({ message: "API VGV SPA funcionando" });
});

// ===============================
// LEVANTAR SERVIDOR
// ===============================
app.listen(PORT, () => {
  console.log(`Servidor VGV SPA escuchando en puerto ${PORT}`);
});
