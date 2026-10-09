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
		passwordHash: process.env.ADMIN_PASSWORD_HASH
	};
	delete process.env.USERS_FILE;
	delete process.env.ADMIN_USERNAME;
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
		if (previous.passwordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
		else process.env.ADMIN_PASSWORD_HASH = previous.passwordHash;
	}
});

test("admin login accepts only explicitly configured bcrypt credentials", async () => {
	const previous = {
		usersFile: process.env.USERS_FILE,
		username: process.env.ADMIN_USERNAME,
		passwordHash: process.env.ADMIN_PASSWORD_HASH
	};
	delete process.env.USERS_FILE;
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
		if (previous.passwordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
		else process.env.ADMIN_PASSWORD_HASH = previous.passwordHash;
	}
});
