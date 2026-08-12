import bcrypt from "bcrypt";
import fs from "fs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = process.env.USERS_FILE || path.join(__dirname, "../data/users.json");
const JWT_SECRET = process.env.JWT_SECRET || "vgv-dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

function readUsers() {
	const raw = fs.readFileSync(USERS_FILE, "utf8");
	const parsed = JSON.parse(raw);

	if (Array.isArray(parsed)) {
		return parsed;
	}

	if (Array.isArray(parsed.users)) {
		return parsed.users;
	}

	return [];
}

export async function loginAuth(req, res) {
	try {
		const username = String(req.body?.username ?? "").trim();
		const password = String(req.body?.password ?? "");

		if (!username || !password) {
			return res.status(400).json({
				error: "Usuario y contraseña son obligatorios."
			});
		}

		const users = readUsers();
		const user = users.find((entry) => String(entry.username ?? "").toLowerCase() === username.toLowerCase());

		if (!user || user.active === false) {
			return res.status(401).json({
				error: "Credenciales inválidas."
			});
		}

		const passwordHash = String(user.passwordHash ?? "");
		const isValid = await bcrypt.compare(password, passwordHash);

		if (!isValid) {
			return res.status(401).json({
				error: "Credenciales inválidas."
			});
		}

		const token = jwt.sign(
			{
				sub: String(user.id ?? user.username),
				username: user.username,
				role: user.role || "admin"
			},
			JWT_SECRET,
			{ expiresIn: JWT_EXPIRES_IN }
		);

		return res.json({
			ok: true,
			token,
			user: {
				id: user.id ?? user.username,
				username: user.username,
				role: user.role || "admin"
			}
		});
	} catch (error) {
		return res.status(500).json({
			error: "No se pudo completar el inicio de sesión."
		});
	}
}