import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcrypt";
import { loginAuth } from "../controllers/auth.controller.js";

function responseRecorder() {
	return {
		statusCode: 200,
		body: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(body) {
			this.body = body;
			return this;
		}
	};
}

test("admin login fails closed when no external credentials are configured", async () => {
	const previous = {
		usersFile: process.env.USERS_FILE,
		username: process.env.ADMIN_USERNAME,
		password: process.env.ADMIN_PASSWORD,
		passwordHash: process.env.ADMIN_PASSWORD_HASH
	};
	delete process.env.USERS_FILE;
	delete process.env.ADMIN_USERNAME;
	delete process.env.ADMIN_PASSWORD;
	delete process.env.ADMIN_PASSWORD_HASH;
	const originalConsoleError = console.error;
	console.error = () => {};

	try {
		const response = responseRecorder();
		await loginAuth({ body: { username: "admin", password: "irrelevant" } }, response);
		assert.equal(response.statusCode, 503);
		assert.equal(response.body.error, "Inicio de sesión no configurado.");
	} finally {
		console.error = originalConsoleError;
		if (previous.usersFile === undefined) delete process.env.USERS_FILE;
		else process.env.USERS_FILE = previous.usersFile;
		if (previous.username === undefined) delete process.env.ADMIN_USERNAME;
		else process.env.ADMIN_USERNAME = previous.username;
		if (previous.password === undefined) delete process.env.ADMIN_PASSWORD;
		else process.env.ADMIN_PASSWORD = previous.password;
		if (previous.passwordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
		else process.env.ADMIN_PASSWORD_HASH = previous.passwordHash;
	}
});

test("admin login accepts only explicitly configured bcrypt credentials", async () => {
	const previous = {
		usersFile: process.env.USERS_FILE,
		username: process.env.ADMIN_USERNAME,
		password: process.env.ADMIN_PASSWORD,
		passwordHash: process.env.ADMIN_PASSWORD_HASH
	};
	delete process.env.USERS_FILE;
	delete process.env.ADMIN_PASSWORD;
	process.env.ADMIN_USERNAME = "secure-admin";
	process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash("test-only-password", 4);

	try {
		const response = responseRecorder();
		await loginAuth(
			{ body: { username: "secure-admin", password: "test-only-password" } },
			response
		);
		assert.equal(response.statusCode, 200);
		assert.equal(response.body.user.username, "secure-admin");
		assert.equal(typeof response.body.token, "string");
	} finally {
		if (previous.usersFile === undefined) delete process.env.USERS_FILE;
		else process.env.USERS_FILE = previous.usersFile;
		if (previous.username === undefined) delete process.env.ADMIN_USERNAME;
		else process.env.ADMIN_USERNAME = previous.username;
		if (previous.password === undefined) delete process.env.ADMIN_PASSWORD;
		else process.env.ADMIN_PASSWORD = previous.password;
		if (previous.passwordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
		else process.env.ADMIN_PASSWORD_HASH = previous.passwordHash;
	}
});

test("fixed admin password takes priority over stale hashes and rejects wrong credentials", async () => {
	const keys = ["USERS_FILE", "ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_PASSWORD_HASH"];
	const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
	delete process.env.USERS_FILE;
	process.env.ADMIN_USERNAME = "admin";
	process.env.ADMIN_PASSWORD = "test-only-fixed-password";
	process.env.ADMIN_PASSWORD_HASH = "stale-invalid-hash";

	try {
		for (const [username, password, expected] of [
			["admin", "test-only-fixed-password", 200],
			["admin", "wrong-password", 401],
			["wrong-user", "test-only-fixed-password", 401]
		]) {
			const response = responseRecorder();
			await loginAuth({ body: { username, password } }, response);
			assert.equal(response.statusCode, expected);
			assert.equal(typeof response.body.token, expected === 200 ? "string" : "undefined");
		}
		process.env.ADMIN_PASSWORD = "test-only-replacement-password";
		const response = responseRecorder();
		await loginAuth({ body: { username: "admin", password: "test-only-replacement-password" } }, response);
		assert.equal(response.statusCode, 200);
	} finally {
		for (const key of keys) {
			if (previous[key] === undefined) delete process.env[key];
			else process.env[key] = previous[key];
		}
	}
});
