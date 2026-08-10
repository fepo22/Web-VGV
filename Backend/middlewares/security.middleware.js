import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import cors from "cors";

export default function securityMiddleware(app) {
  app.disable("x-powered-by");
  app.use(helmet());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Demasiadas solicitudes, intenta más tarde."
  });
  app.use(limiter);

  app.use(cors({
    origin: process.env.CLIENT_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: false
  }));

  app.use(xss());
  app.use(mongoSanitize());
}
export const applySecurity = app => {
  app.disable("x-powered-by");

  app.use(helmet());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Demasiadas solicitudes, intenta más tarde."
  });
  app.use(limiter);

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: false
    })
  );

  app.use(xss());
  app.use(mongoSanitize());
};
console.log("Seguridad aplicada correctamente");
