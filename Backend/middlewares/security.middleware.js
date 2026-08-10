import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import cors from "cors";

const blockedAgents = [/curl/i, /wget/i, /python/i, /spider/i, /bot/i];

export const applySecurity = app => {
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "frame-src": ["'self'", "https://www.google.com", "https://maps.google.com"]
        }
      }
    })
  );

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Demasiadas solicitudes, intenta más tarde.",
    skip: req => !req.path.startsWith("/api")
  });
  app.use(limiter);

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: false
    })
  );

  // Replica en Express el filtrado basico de user-agent que antes dependia de Apache.
  app.use((req, res, next) => {
    if (req.method !== "POST") return next();

    const userAgent = req.get("user-agent") || "";
    if (blockedAgents.some(pattern => pattern.test(userAgent))) {
      return res.status(403).json({ error: "Solicitud bloqueada por seguridad" });
    }

    next();
  });

  app.use(xss());
  app.use(mongoSanitize());
};
