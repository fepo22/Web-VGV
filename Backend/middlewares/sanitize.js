import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";

export const sanitizeMiddleware = (req, res, next) => {
  // Sanitiza contra NoSQL Injection
  mongoSanitize()(req, res, () => {
    // Sanitiza contra XSS
    xss()(req, res, next);
  });
};
