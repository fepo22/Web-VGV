import { createHash, timingSafeEqual } from "node:crypto";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const digest = (value) => createHash("sha256").update(value).digest();
const safeEqual = (a, b) => timingSafeEqual(digest(a), digest(b));

export function getAdminToken() {
	return ADMIN_TOKEN;
}

export function adminAuthMiddleware(req, res, next) {
	const token = req.headers.authorization?.split(" ")[1];

	if (!token || !ADMIN_TOKEN || !safeEqual(token, ADMIN_TOKEN)) {
		return res.status(401).json({
			status: 401,
			error: "Acceso no autorizado. Inicia sesión como administrador."
		});
	}

	next();
}

export default adminAuthMiddleware;