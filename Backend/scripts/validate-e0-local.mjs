import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, realpath, readdir, readlink, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	cleanEnvironment, createOwnedDirectory, databaseName, integrationUri,
	removeOwnedDirectory, verifyOwner, verifyIntegrationEnvironment
} from "../integration/e0-support.mjs";

const execute = promisify(execFile);
const filename = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
const help = "node Backend/scripts/validate-e0-local.mjs --mongod <absolute official mongod executable>";

async function freePort() {
	const server = net.createServer();
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const { port } = server.address();
	await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	return port;
}

async function verifyListener(pid, port, executable) {
	if (process.platform === "win32") {
		// Values interpolated here are integers, not shell input.
		const script = `$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; $l=@(Get-NetTCPConnection -State Listen -LocalPort ${port}); [pscustomobject]@{pid=$p.ProcessId;executable=$p.ExecutablePath;listeners=@($l | ForEach-Object { [pscustomobject]@{address=$_.LocalAddress;pid=$_.OwningProcess} })} | ConvertTo-Json -Depth 4 -Compress`;
		const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
			env: cleanEnvironment(), timeout: 15000, windowsHide: true
		});
		const info = JSON.parse(stdout.replace(/^\uFEFF/, ""));
		assert.equal(info.pid, pid);
		assert.equal((await realpath(info.executable)).toLowerCase(), executable.toLowerCase());
		assert.ok(info.listeners.length > 0);
		for (const listener of info.listeners) {
			assert.equal(listener.address, "127.0.0.1");
			assert.equal(listener.pid, pid);
		}
	} else if (process.platform === "linux") {
		assert.equal(await realpath(`/proc/${pid}/exe`), executable);
		const descriptors = await readdir(`/proc/${pid}/fd`);
		const links = await Promise.all(descriptors.map((fd) => readlink(`/proc/${pid}/fd/${fd}`).catch(() => "")));
		const rows = (await readFile(`/proc/${pid}/net/tcp`, "utf8")).trim().split("\n").slice(1);
		const listeners = rows.map((row) => row.trim().split(/\s+/))
			.filter((row) => row[3] === "0A" && parseInt(row[1].split(":")[1], 16) === port);
		assert.equal(listeners.length, 1);
		assert.equal(listeners[0][1].split(":")[0], "0100007F");
		assert.ok(links.includes(`socket:[${listeners[0][9]}]`));
	} else {
		throw new Error("Listener ownership verification supports Windows and Linux only");
	}
}

async function stopOwnedProcess(child, exited) {
	if (!child || child.exitCode !== null || child.signalCode !== null) return;
	child.kill("SIGTERM");
	let timer;
	const stopped = await Promise.race([exited.then(() => true), new Promise((r) => { timer = setTimeout(() => r(false), 8000); })]);
	clearTimeout(timer);
	if (!stopped) {
		child.kill("SIGKILL");
		try {
			await Promise.race([exited, new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error("Child did not exit")), 8000);
			})]);
		} finally {
			clearTimeout(timer);
		}
	}
	assert.ok(child.exitCode !== null || child.signalCode !== null);
}

async function worker(binary) {
	const report = {
		kind: "vgv-e0-local", status: "failed", integrationExecuted: false,
		checks: [], findings: [], cleanup: {}, limits: [
			"Synthetic loopback app; real admin auth/router exercised for RI-03 only; no server.js, frontend or full production middleware stack.",
			"Product unique index prepared only by verified synthetic suite; not an inventory of commercial indexes.",
			"Official binary provenance is the operator's responsibility; nothing is downloaded or installed."
		]
	};
	let stage = "ownership";
	let owned;
	let child;
	let exited;
	let mongoose;
	let db;
	let cleanupSuite;
	let verified = false;
	let interrupted = false;
	const onSignal = () => { interrupted = true; };
	process.on("SIGINT", onSignal);
	process.on("SIGTERM", onSignal);
	// Application diagnostics are not forwarded: driver errors can contain connection strings.
	console.log = console.error = console.warn = console.info = () => {};
	try {
		const runId = process.env.VGV_E0_LOCAL_RUN;
		const dbName = databaseName(runId);
		const executable = await realpath(binary);
		assert.match(path.basename(executable), /^mongod(?:\.exe)?$/i);
		owned = await createOwnedDirectory(runId);
		const dbPath = path.join(owned.root, "db");
		await mkdir(dbPath);
		const port = await freePort();
		process.env.E0_INTEGRATION_CONFIG = JSON.stringify({
			runId, port, dbPath, root: owned.root, owner: owned.owner
		});
		report.runId = runId;
		report.instance = { port, database: dbName, executable, dbPath };
		await verifyOwner(owned.root, owned.owner);
		stage = "spawn";
		const mongoArgs = ["--bind_ip", "127.0.0.1", "--port", String(port), "--dbpath", dbPath];
		// Windows mongod does not expose the Unix-domain socket option.
		if (process.platform !== "win32") mongoArgs.push("--nounixsocket");
		child = spawn(executable, mongoArgs, {
			env: cleanEnvironment(), stdio: "ignore", windowsHide: true
		});
		let spawnError;
		child.once("error", (error) => { spawnError = error; });
		exited = new Promise((resolve) => {
			child.once("exit", resolve);
			child.once("error", resolve);
		});
		report.instance.pid = child.pid;
		stage = "readiness";
		for (const key of ["NODE_OPTIONS", "NODE_PATH", "VERCEL", "PUBLIC_BACKEND_URL", "JWT_SECRET", "MONGO_URI", "MONGODB_URI", "MONGO_DB_NAME"]) {
			assert.equal(process.env[key], undefined);
		}
		report.checks.push({ name: "clean worker before database/application imports", status: "passed" });
		({ default: mongoose } = await import("mongoose"));
		mongoose.set("autoIndex", false);
		mongoose.set("autoCreate", false);
		const uri = integrationUri(port, runId);
		const client = new mongoose.mongo.MongoClient(uri);
		try {
			const deadline = Date.now() + 30000;
			while (true) {
				if (spawnError) throw spawnError;
				assert.equal(child.exitCode, null);
				assert.equal(child.signalCode, null);
				assert.equal(interrupted, false);
				try {
					await client.connect();
					break;
				} catch {
					if (Date.now() > deadline) throw new Error("Mongo readiness timeout");
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			}
			stage = "verify-instance";
			await verifyListener(child.pid, port, executable);
			const admin = client.db("admin");
			const [options, build, hello, status, databases] = await Promise.all([
				admin.command({ getCmdLineOpts: 1 }), admin.command({ buildInfo: 1 }),
				admin.command({ hello: 1 }), admin.command({ serverStatus: 1 }),
				admin.command({ listDatabases: 1, nameOnly: true })
			]);
			assert.equal(Number(status.pid), child.pid);
			assert.equal(options.parsed.net.bindIp, "127.0.0.1");
			assert.equal(options.parsed.net.port, port);
			assert.equal(await realpath(options.parsed.storage.dbPath), await realpath(dbPath));
			assert.equal(options.parsed.replication?.replSetName, undefined);
			assert.equal(hello.msg, undefined); // no mongos
			assert.equal(hello.setName, undefined);
			assert.equal(hello.isWritablePrimary, true);
			assert.equal(databases.databases.some((item) => item.name === dbName), false);
			assert.equal((await client.db(dbName).listCollections().toArray()).length, 0);
			assert.match(build.version, /^\d+\./);
			report.instance.version = build.version;
			report.checks.push({ name: "PID/listener/config/buildInfo/hello/database-absent", status: "passed" });
			verified = true;
		} finally {
			await client.close();
		}
		stage = "integration";
		process.env.MONGO_URI = process.env.MONGODB_URI = uri;
		process.env.MONGO_DB_NAME = dbName;
		verifyIntegrationEnvironment(process.env, port, runId);
		// No store or model has been imported before both global settings and verification.
		const { createSuite } = await import("../integration/e0-local.mjs");
		const suite = await createSuite({ mongoose, runId, report, interrupted: () => interrupted });
		cleanupSuite = suite.cleanup;
		db = mongoose.connection.db;
		report.integrationExecuted = true;
		await suite.run();
		assert.equal(interrupted, false);
		report.status = report.checks.some((check) => check.status === "failed") ? "failed"
			: report.findings.length ? "passed-with-findings" : "passed";
	} catch (error) {
		report.failure = { stage, type: error.name }; // never print error.message/stack/URI
	} finally {
		try {
			if (cleanupSuite) await cleanupSuite();
			report.cleanup.ownedResourcesRemoved = Boolean(cleanupSuite);
			if (verified && mongoose?.connection.readyState === 1) {
				db = mongoose.connection.db;
				const collections = await db.listCollections({}, { nameOnly: true }).toArray();
				const counts = await Promise.all(collections.map(async ({ name }) => ({
					name, count: await db.collection(name).countDocuments({})
				})));
				report.cleanup.collections = counts;
				report.cleanup.databaseEmpty = counts.every(({ count }) => count === 0);
				assert.equal(report.cleanup.databaseEmpty, true);
			}
		} catch (error) {
			report.status = "failed";
			report.cleanup.failure = error.name;
		}
		try {
			if (mongoose) await mongoose.disconnect();
		} catch {
			report.status = "failed";
			report.cleanup.disconnectFailed = true;
		}
		try {
			await stopOwnedProcess(child, exited);
			report.cleanup.processStopped = true;
			if (child) report.cleanup.processExit = { code: child.exitCode, signal: child.signalCode };
		} catch {
			report.status = "failed";
			report.cleanup.processStopped = false;
		}
		if (owned && report.cleanup.processStopped && !report.cleanup.failure) {
			try {
				await removeOwnedDirectory(owned.root, owned.owner);
				report.cleanup.directoryRemoved = true;
			} catch {
				report.status = "failed";
				report.cleanup.directoryRemoved = false;
			}
		}
		process.removeListener("SIGINT", onSignal);
		process.removeListener("SIGTERM", onSignal);
		report.summary = {
			checksPassed: report.checks.filter((check) => check.status === "passed").length,
			checksFailed: report.checks.filter((check) => check.status === "failed").length,
			findings: report.findings.length
		};
		process.stdout.write(`${JSON.stringify(report)}\n`);
		process.exitCode = report.status === "failed" ? 1 : 0;
	}
}

if (args.length === 1 && args[0] === "--help") {
	process.stdout.write(`${help}\nOptions: --mongod only; no URI, port, dbPath, dotenv or seed input accepted.\n`);
} else if (args.length === 3 && args[0] === "--owned-worker" && args[1] === process.env.VGV_E0_LOCAL_RUN) {
	await worker(args[2]);
} else if (args.length === 2 && args[0] === "--mongod" && path.isAbsolute(args[1])) {
	// execArgv intentionally NOT inherited (including --require/--import).
	const env = cleanEnvironment();
	env.VGV_E0_LOCAL_RUN = randomBytes(16).toString("hex");
	const child = spawn(process.execPath, [filename, "--owned-worker", env.VGV_E0_LOCAL_RUN, args[1]], {
		env, stdio: ["ignore", "inherit", "pipe"], windowsHide: true
	});
	child.stderr.resume(); // do not leak a driver's diagnostics on an unexpected crash
	const forward = () => child.kill("SIGTERM");
	process.on("SIGINT", forward);
	process.on("SIGTERM", forward);
	await new Promise((resolve) => {
		child.once("error", () => { process.exitCode = 1; resolve(); });
		child.once("exit", (code) => { process.exitCode = code ?? 1; resolve(); });
	});
	process.removeListener("SIGINT", forward);
	process.removeListener("SIGTERM", forward);
} else {
	process.stdout.write(`${JSON.stringify({ status: "not-run", error: "Invalid arguments", usage: help })}\n`);
	process.exitCode = 2;
}
