import bcrypt from "bcrypt";
import fs from "fs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../middlewares/auth.js";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

class AdminAuthConfigurationError extends Error {}

let configuredPassword;
let configuredPasswordHash;

async function readUsers() {
	if (process.env.USERS_FILE) {
		const raw = fs.readFileSync(process.env.USERS_FILE, "utf8");
		const parsed = JSON.parse(raw);

		if (Array.isArray(parsed)) {
			return parsed;
		}

		if (Array.isArray(parsed.users)) {
			return parsed.users;
		}

		throw new AdminAuthConfigurationError("USERS_FILE debe contener una lista de usuarios.");
	}

	const username = String(process.env.ADMIN_USERNAME ?? "").trim();
	const password = process.env.ADMIN_PASSWORD;
	let passwordHash = String(process.env.ADMIN_PASSWORD_HASH ?? "");
	if (password) {
		if (Buffer.byteLength(password, "utf8") > 72) {
			throw new AdminAuthConfigurationError("ADMIN_PASSWORD no puede superar 72 bytes.");
		}
		if (password !== configuredPassword) {
			configuredPassword = password;
			configuredPasswordHash = bcrypt.hash(password, 12);
		}
		passwordHash = await configuredPasswordHash;
	}
	if (!username && !passwordHash) {
		throw new AdminAuthConfigurationError("Faltan ADMIN_USERNAME y ADMIN_PASSWORD o ADMIN_PASSWORD_HASH.");
	}

	if (!username || !BCRYPT_HASH_PATTERN.test(passwordHash)) {
		throw new AdminAuthConfigurationError("ADMIN_USERNAME o ADMIN_PASSWORD_HASH no son válidos.");
	}

	return [{ id: username, username, passwordHash, role: "admin", active: true }];
}

export async function loginAuth(req, res) {
	const username = String(req.body?.username ?? "").trim();
	const password = String(req.body?.password ?? "");

	if (!username || !password) {
		return res.status(400).json({
			error: "Usuario y contraseña son obligatorios."
		});
	}

	let users;
	try {
		users = await readUsers();
	} catch (error) {
		if (error instanceof AdminAuthConfigurationError) {
			console.error(`Autenticación administrativa no configurada: ${error.message}`);
			return res.status(503).json({ error: "Inicio de sesión no configurado." });
		}

		console.error("No se pudo leer la configuración de autenticación administrativa.", error);
		return res.status(500).json({ error: "No se pudo completar el inicio de sesión." });
	}

	const user = users.find((entry) => String(entry.username ?? "").toLowerCase() === username.toLowerCase());

	if (!user || user.active === false) {
		return res.status(401).json({
			error: "Credenciales inválidas."
		});
	}

	try {
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
			getJwtSecret(),
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
		console.error("No se pudo completar el inicio de sesión administrativo.", error);
		return res.status(500).json({
			error: "No se pudo completar el inicio de sesión."
		});
	}
}