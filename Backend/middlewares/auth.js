import jwt from "jsonwebtoken";

  const configuredJwtSecret = process.env.JWT_SECRET;
  if (!configuredJwtSecret && (process.env.VERCEL || process.env.NODE_ENV === "production")) {
    throw new Error("Falta JWT_SECRET en producción");
  }
  const JWT_SECRET = configuredJwtSecret || "vgv-dev-secret";

export function getJwtSecret() {
  return JWT_SECRET;
}

function extractBearerToken(authorization = "") {
	return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export function verifyJwtToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export const authMiddleware = (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";
    const token = extractBearerToken(authorization);

    if (!token) {
      return res.status(401).json({
        status: 401,
        error: "Acceso no autorizado. Falta token."
      });
    }

    const decoded = verifyJwtToken(token);
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Acceso exclusivo para administradores." });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 401,
      error: "Token inválido o expirado."
    });
  }
};

export { extractBearerToken };
export default authMiddleware;