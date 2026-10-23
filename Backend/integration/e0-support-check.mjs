import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
	barrier, cleanEnvironment, createOwnedDirectory, databaseName, integrationUri,
	verifyIntegrationEnvironment, verifyOwner, removeOwnedDirectory, withMethod, OWNER_FILE, verifyDisconnected
} from "./e0-support.mjs";

test("clean environment excludes URI, dotenv/preloads and arbitrary application settings", () => {
	const env = cleanEnvironment({ PATH: "safe", MONGO_URI: "secret", NODE_OPTIONS: "--require bad", NODE_PATH: "bad", DOTENV_CONFIG_PATH: "bad", PUBLIC_BACKEND_URL: "bad", VERCEL: "1", JWT_SECRET: "bad", E0_INTEGRATION_CONFIG: "inherited" });
	assert.deepEqual(env, { PATH: "safe", NODE_ENV: "test" });
});

test("inherited connected/connecting/disconnecting Mongoose state is rejected", () => {
	verifyDisconnected({ readyState: 0 });
	for (const readyState of [1, 2, 3]) assert.throws(() => verifyDisconnected({ readyState }));
});

test("runner rejects arbitrary connection input without loading Mongo or starting a process", async () => {
	const runner = fileURLToPath(new URL("../scripts/validate-e0-local.mjs", import.meta.url));
	const execute = promisify(execFile);
	for (const args of [
		["--mongod", "mongodb://127.0.0.1:27017/arbitrary"],
		["--uri", "mongodb+srv://example.invalid/arbitrary"],
		["--mongod", "relative/mongod"],
		["--owned-worker", "foreign", "anything"]
	]) {
		await assert.rejects(execute(process.execPath, [runner, ...args], {
			env: cleanEnvironment(), timeout: 5000
		}), (error) => {
			assert.equal(error.code, 2);
			const output = JSON.parse(error.stdout);
			assert.equal(output.status, "not-run");
			assert.equal(output.error, "Invalid arguments");
			assert.equal(output.integrationExecuted, undefined);
			assert.equal(error.stdout.includes("mongodb"), false);
			return true;
		});
	}
});

test("exact loopback destination, exclusive run capability and DB required", () => {
	const runId = "a".repeat(32);
	const config = { runId, port: 49123, root: path.resolve("synthetic"), dbPath: path.resolve("synthetic", "db"), owner: { runId } };
	const env = { VGV_E0_LOCAL_RUN: runId, E0_INTEGRATION_CONFIG: JSON.stringify(config), MONGO_URI: integrationUri(49123, runId), MONGODB_URI: integrationUri(49123, runId), MONGO_DB_NAME: databaseName(runId) };
	verifyIntegrationEnvironment(env, 49123, runId);
	for (const changed of [
		{ MONGO_URI: "mongodb+srv://example.invalid" }, { MONGODB_URI: "mongodb://127.0.0.1:1/wrong" },
		{ MONGO_DB_NAME: "vgv" }, { VGV_E0_LOCAL_RUN: "other" }, { NODE_OPTIONS: "--import bad" },
		{ NODE_PATH: "bad" }, { E0_INTEGRATION_CONFIG: undefined }, { VERCEL: "1" },
		{ PUBLIC_BACKEND_URL: "bad" }, { JWT_SECRET: "bad" },
		{ E0_INTEGRATION_CONFIG: JSON.stringify({ ...config, owner: { runId: "foreign" } }) },
		{ E0_INTEGRATION_CONFIG: JSON.stringify({ ...config, port: 27017 }) }
	]) assert.throws(() => verifyIntegrationEnvironment({ ...env, ...changed }, 49123, runId));
	assert.throws(() => databaseName("../bad"));
	assert.throws(() => integrationUri(0, runId));
});

test("barrier releases only after both participants", async () => {
	const gate = barrier(2, 1000);
	let passed = false;
	const first = gate.arrive().then(() => { passed = true; });
	await Promise.resolve();
	assert.equal(passed, false);
	await Promise.all([first, gate.arrive()]);
	assert.equal(gate.arrivals, 2);
	assert.equal(passed, true);
});

test("barrier timeout rejects a stranded request rather than allowing a write", async () => {
	const gate = barrier(2, 20);
	await assert.rejects(gate.arrive(), /timeout/);
});

test("method instrumentation restores original even on failure", async () => {
	const target = { value() { return 1; } };
	const original = target.value;
	await assert.rejects(withMethod(target, "value", (real) => () => real() + 1, async () => {
		assert.equal(target.value(), 2);
		throw new Error("synthetic");
	}));
	assert.equal(target.value, original);
});

test("directory cleanup requires exact owner marker and rejects tampering", async () => {
	const runId = randomBytes(16).toString("hex");
	const { root, owner } = await createOwnedDirectory(runId);
	try {
		await verifyOwner(root, owner);
		const marker = path.join(root, OWNER_FILE);
		const original = await readFile(marker, "utf8");
		await writeFile(marker, JSON.stringify({ ...owner, nonce: "foreign" }));
		await assert.rejects(removeOwnedDirectory(root, owner));
		await writeFile(marker, original);
		await removeOwnedDirectory(root, owner);
		await assert.rejects(readFile(marker));
	} finally {
		// Verify before any fallback deletion, including in this helper test.
		try { await verifyOwner(root, owner); await rm(root, { recursive: true }); } catch { /* leave unowned paths alone */ }
	}
});
