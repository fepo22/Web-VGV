import "dotenv/config";
import compression from "compression";
import express from "express";
import fs from "fs";
import { createServer } from "http";
import morgan from "morgan";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { fileURLToPath } from "url";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

import { applySecurity } from "./middlewares/security.middleware.js";
import { connectProductsDatabase, syncSeedProducts } from "./data/products.store.js";
import { extractBearerToken, verifyJwtToken } from "./middlewares/auth.js";
import { setSocketServer } from "./realtime/socket.js";

import authRoutes from "./routes/auth.routes.js";
import publicProductsRoutes from "./routes/products.public.routes.js";
import productsRoutes from "./routes/products.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import cotizarRoutes from "./routes/cotizar.routes.js";

// ===============================
// FIX para __dirname en ES Modules
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_ASSETS_DIR = path.join(__dirname, "../public");
const FRONTEND_DIST_DIR = path.join(__dirname, "../public_html/catalogo/dist");
const FRONTEND_INDEX_FILE = path.join(FRONTEND_DIST_DIR, "index.html");
const hasFrontendBuild = fs.existsSync(FRONTEND_INDEX_FILE);
const PORT = process.env.PORT || 3000;
const LOG_DIR = path.join(__dirname, "logs");

function envFlag(name, fallback = false) {
  const value = process.env[name];
  if (typeof value !== "string") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

const AUTO_SYNC_SEED = envFlag("AUTO_SYNC_SEED", false);
const AUTO_SYNC_REMOVE_MISSING = envFlag("AUTO_SYNC_REMOVE_MISSING", false);

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const loggerFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    const output = stack || message;
    return `${timestamp} ${level}: ${output}`;
  })
);

const logger = winston.createLogger({
  level: "info",
  format: loggerFormat,
  transports: [
    new winston.transports.Console({ level: "info" }),
    new DailyRotateFile({
      level: "info",
      filename: path.join(LOG_DIR, "app.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      zippedArchive: false
    })
  ]
});

// ===============================
// APP
// ===============================
const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";
const CATALOG_URL = process.env.CATALOG_URL || (isProduction ? "" : "http://localhost:5173");

// Middleware global
app.use(morgan("combined"));
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Seguridad
applySecurity(app);

// Servir solo assets publicos (imagenes/favicons/etc) sin exponer paginas legacy.
app.use(express.static(PUBLIC_ASSETS_DIR, { index: false }));

const LEGACY_ROUTE_REDIRECTS = {
  "/index.html": "/",
  "/ofertas.html": "/catalogo?linea=todas&ofertas=1",
  "/quienes.html": "/",
  "/contacto.html": "/checkout",
  "/cotizar.html": "/checkout",
  "/calefaccion.html": "/catalogo?linea=calefont-calefaccion",
  "/canalizacion.html": "/catalogo?linea=canalizacion",
  "/griferias.html": "/catalogo?linea=griferias-sanitarios",
  "/pegamentos.html": "/catalogo?linea=pegamentos-cementos"
};

app.get(Object.keys(LEGACY_ROUTE_REDIRECTS), (req, res) => {
  return res.redirect(301, LEGACY_ROUTE_REDIRECTS[req.path] || "/");
});

if (hasFrontendBuild) {
  app.use(express.static(FRONTEND_DIST_DIR));
}

// ===============================
// RUTAS API
// ===============================
app.use("/auth", authRoutes);
app.use("/admin/products", productsRoutes);
app.use("/api/products", publicProductsRoutes);
app.use("/api/productos", publicProductsRoutes);
app.use("/api/contacto", contactRoutes);
app.use("/api/cotizar", cotizarRoutes);

// Healthcheck explicito para monitoreo
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "vgv-backend" });
});

app.get(/^(?!\/api\/).*/, (req, res) => {
  if (hasFrontendBuild) {
    return res.sendFile(FRONTEND_INDEX_FILE);
  }

  if (CATALOG_URL) {
    return res.redirect(`${CATALOG_URL}${req.originalUrl}`);
  }

  return res.status(503).send("Catalogo no configurado. Define CATALOG_URL en el servidor.");
});

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

io.use((socket, next) => {
  try {
    const authToken = String(socket.handshake.auth?.token || "");
    const headerToken = extractBearerToken(String(socket.handshake.headers?.authorization || ""));
    const token = authToken || headerToken;

    if (!token) {
      return next(new Error("Token no provisto"));
    }

    socket.data.user = verifyJwtToken(token);
    return next();
  } catch {
    return next(new Error("Token inválido o expirado"));
  }
});

io.on("connection", (socket) => {
  logger.info(`Socket conectado: ${socket.id}`);

  socket.on("disconnect", () => {
    logger.info(`Socket desconectado: ${socket.id}`);
  });
});

setSocketServer(io);

export { app, httpServer, io, logger };
export default app;

// ===============================
// LEVANTAR SERVIDOR
// ===============================
if (process.argv[1] === __filename) {
  connectProductsDatabase()
    .then(async () => {
      if (AUTO_SYNC_SEED) {
        const syncedProducts = await syncSeedProducts({ removeMissing: AUTO_SYNC_REMOVE_MISSING });
        logger.info(
          `Seed sincronizado al iniciar: ${syncedProducts.length} productos (removeMissing=${AUTO_SYNC_REMOVE_MISSING})`
        );
      }

      httpServer.listen(PORT, () => {
        logger.info(`Servidor VGV SPA escuchando en puerto ${PORT}`);
      });
    })
    .catch((error) => {
      logger.error(`No se pudo conectar a MongoDB: ${error.message}`);
      process.exit(1);
    });
}
