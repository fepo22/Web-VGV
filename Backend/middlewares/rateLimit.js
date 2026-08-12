import rateLimit from "express-rate-limit";

export const contactLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 3, // máximo 3 solicitudes por minuto
  message: {
    status: 429,
    error: "Demasiadas solicitudes. Intenta nuevamente en un minuto."
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    status: 429,
    error: "Demasiados intentos. Intenta nuevamente más tarde."
  }
});

export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    status: 429,
    error: "Demasiadas solicitudes administrativas. Intenta nuevamente en un minuto."
  }
});
