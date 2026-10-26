import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { compareIndexes, specsFromSchema } from "../utils/index-verifier.js";
import {
	isAuthFailure,
	isTokenExpired,
	loginErrorMessage,
	LOGIN_CONNECTION_MESSAGE,
	sessionFailureMessage,
	setSessionFlash,
	takeSessionFlash,
	SESSION_EXPIRED_MESSAGE
} from "../../catalogo-vgv/src/lib/utils/admin-session.js";

const jwtWith = (payload) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

test("admin-session: 401/403 y mensajes", () => {
	assert.equal(isAuthFailure(401), true);
	assert.equal(isAuthFailure(403), true);
	assert.equal(isAuthFailure(500), false);
	assert.equal(sessionFailureMessage(401), SESSION_EXPIRED_MESSAGE);
	assert.notEqual(sessionFailureMessage(403), SESSION_EXPIRED_MESSAGE);
	assert.equal(sessionFailureMessage(404), null);
});

test("login: fallo de red da mensaje en español y los errores de autenticación se conservan", () => {
	assert.equal(loginErrorMessage(new TypeError("Failed to fetch")), LOGIN_CONNECTION_MESSAGE);
	assert.doesNotMatch(LOGIN_CONNECTION_MESSAGE, /fetch/i);
	assert.equal(loginErrorMessage(new Error("Credenciales inválidas.")), "Credenciales inválidas.");
	assert.equal(loginErrorMessage("x"), "Error inesperado.");
});

test("admin-session: vencimiento del token", () => {
	const now = 1_000_000_000_000;
	assert.equal(isTokenExpired(null, now), true);
	assert.equal(isTokenExpired("basura", now), true);
	assert.equal(isTokenExpired(jwtWith({ exp: now / 1000 - 1 }), now), true);
	assert.equal(isTokenExpired(jwtWith({ exp: now / 1000 + 60 }), now), false);
	assert.equal(isTokenExpired(jwtWith({ role: "admin" }), now), false);
});

test("admin-session: aviso diferido se consume una vez", () => {
	const data = new Map();
	const storage = { setItem: (k, v) => data.set(k, v), getItem: (k) => data.get(k) ?? null, removeItem: (k) => data.delete(k) };
	setSessionFlash("hola", storage);
	assert.equal(takeSessionFlash(storage), "hola");
	assert.equal(takeSessionFlash(storage), "");
	assert.equal(takeSessionFlash(null), "");
});

test("index-verifier: detecta faltantes, diferencias y sobrantes sin acceso a BD", () => {
	const schema = new mongoose.Schema({ id: { type: String, unique: true }, codigo: String });
	schema.index({ codigo: 1 });
	const expected = { products: specsFromSchema(schema, [{ name: "e0_codigo_unique", key: { codigo: 1 }, unique: true }]) };
	const ok = [
		{ name: "_id_", key: { _id: 1 } },
		{ name: "id_1", key: { id: 1 }, unique: true },
		{ name: "codigo_1", key: { codigo: 1 } },
		{ name: "e0_codigo_unique", key: { codigo: 1 }, unique: true }
	];
	assert.deepEqual(compareIndexes(expected, { products: ok }), []);

	const broken = [
		{ name: "_id_", key: { _id: 1 } },
		{ name: "id_1", key: { id: 1 } },
		{ name: "extra_1", key: { extra: 1 } }
	];
	const types = compareIndexes(expected, { products: broken }).map((r) => `${r.type}:${r.name}`).sort();
	assert.deepEqual(types, [
		"mismatch:id_1",
		"missing_index:codigo_1",
		"missing_index:e0_codigo_unique",
		"unexpected_index:extra_1"
	]);
	assert.equal(compareIndexes(expected, { products: null })[0].type, "missing_collection");
});
