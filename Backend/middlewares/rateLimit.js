import rateLimit from "express-rate-limit";

export const contactLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 3, // máximo 3 solicitudes por minuto
  message: {
    status: 429,
    error: "Demasiadas solicitudes. Intenta nuevamente en un minuto."
  }
});
