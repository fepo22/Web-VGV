import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "vgv-dev-secret";

function extractBearerToken(authorization = "") {
	return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export function verifyJwtToken(token) {
	return jwt.verify(token, JWT_SECRET);
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