import assert from "node:assert/strict";
import test from "node:test";

test("legacy admin token middleware has no default credential and fails closed", async () => {
	const configuredToken = process.env.ADMIN_TOKEN;
	delete process.env.ADMIN_TOKEN;
	try {
		const { adminAuthMiddleware, getAdminToken } = await import(
			`../middlewares/adminAuth.js?isolated=${Date.now()}`
		);
		assert.equal(getAdminToken(), "");

		const response = {
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
		let nextCalled = false;
		adminAuthMiddleware(
			{ headers: { authorization: "Bearer vgv-admin-token" } },
			response,
			() => {
				nextCalled = true;
			}
		);
		assert.equal(response.statusCode, 401);
		assert.equal(nextCalled, false);
	} finally {
		if (configuredToken === undefined) delete process.env.ADMIN_TOKEN;
		else process.env.ADMIN_TOKEN = configuredToken;
	}
});
