const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "vgv-admin-token";

export function getAdminToken() {
	return ADMIN_TOKEN;
}

export function adminAuthMiddleware(req, res, next) {
	const token = req.headers.authorization?.split(" ")[1];

	if (!token || token !== ADMIN_TOKEN) {
		return res.status(401).json({
			status: 401,
			error: "Acceso no autorizado. Inicia sesión como administrador."
		});
	}

	next();
}

export default adminAuthMiddleware;