import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, lstat, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const OWNER_FILE = "e0-owner.json";
export const RUN_PATTERN = /^[a-f0-9]{32}$/;

export function cleanEnvironment(source = process.env) {
	const result = {};
	for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT", "SystemDrive"]) {
		if (source[key]) result[key] = source[key];
	}
	result.NODE_ENV = "test";
	return result;
}

export function databaseName(runId) {
	assert.match(runId, RUN_PATTERN);
	return `vgv_e0_integration_${runId}`;
}

export function integrationUri(port, runId) {
	assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
	return `mongodb://127.0.0.1:${port}/${databaseName(runId)}?directConnection=true&serverSelectionTimeoutMS=3000&connectTimeoutMS=3000&socketTimeoutMS=10000`;
}

export function verifyIntegrationEnvironment(env, port, runId) {
	assert.equal(env.VGV_E0_LOCAL_RUN, runId);
	const config = JSON.parse(env.E0_INTEGRATION_CONFIG);
	assert.equal(config.runId, runId);
	assert.equal(config.port, port);
	assert.equal(config.owner.runId, runId);
	assert.ok(path.isAbsolute(config.dbPath));
	assert.ok(path.isAbsolute(config.root));
	assert.equal(path.dirname(config.dbPath), config.root);
	assert.equal(path.basename(config.dbPath), "db");
	assert.equal(env.MONGO_URI, integrationUri(port, runId));
	assert.equal(env.MONGODB_URI, env.MONGO_URI);
	assert.equal(env.MONGO_DB_NAME, databaseName(runId));
	assert.equal(env.NODE_OPTIONS, undefined);
	assert.equal(env.NODE_PATH, undefined);
	for (const key of ["VERCEL", "PUBLIC_BACKEND_URL", "JWT_SECRET", "JWT_ADMIN_SECRET", "DOTENV_CONFIG_PATH"]) {
		assert.equal(env[key], undefined);
	}

}

export function verifyDisconnected(connection) {
	assert.equal(connection.readyState, 0, "Refuse an inherited/open application connection");
}

export async function createOwnedDirectory(runId) {
	assert.match(runId, RUN_PATTERN);
	const root = await mkdtemp(path.join(os.tmpdir(), `vgv-e0-${runId}-`));
	const owner = { runId, nonce: randomUUID(), runnerPid: process.pid };
	await writeFile(path.join(root, OWNER_FILE), JSON.stringify(owner), { flag: "wx" });
	return { root, owner };
}

export async function verifyOwner(root, owner) {
	assert.equal((await lstat(root)).isSymbolicLink(), false);
	const actual = await realpath(root);
	const temporary = await realpath(os.tmpdir());
	assert.equal(path.dirname(actual).toLowerCase(), temporary.toLowerCase());
	assert.ok(path.basename(actual).startsWith(`vgv-e0-${owner.runId}-`));
	const marker = path.join(root, OWNER_FILE);
	assert.equal((await lstat(marker)).isSymbolicLink(), false);
	assert.deepEqual(JSON.parse(await readFile(marker, "utf8")), owner);
}

export async function removeOwnedDirectory(root, owner) {
	await verifyOwner(root, owner);
	await rm(root, { recursive: true, force: false });
}

// Both callers must reach the exact write boundary. Timeout rejects, never releases
// a single caller to write by itself.
export function barrier(parties = 2, timeoutMs = 10000) {
	let arrivals = 0;
	let resolve;
	let reject;
	const ready = new Promise((r) => { resolve = r; });
	const gate = new Promise((r, j) => { reject = j; ready.then(r); });
	const timer = setTimeout(() => reject(new Error("E0 barrier timeout")), timeoutMs);
	gate.finally(() => clearTimeout(timer)).catch(() => {});
	return {
		async arrive() {
			arrivals += 1;
			assert.ok(arrivals <= parties, "Unexpected barrier participant");
			if (arrivals === parties) resolve();
			await gate;
		},
		get arrivals() { return arrivals; }
	};
}

export async function withMethod(target, key, replacement, action) {
	const original = target[key];
	target[key] = replacement(original);
	try {
		return await action();
	} finally {
		target[key] = original;
	}
}
