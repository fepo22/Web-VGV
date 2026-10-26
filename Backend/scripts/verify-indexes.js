// Verificador de índices de SOLO LECTURA: compara los índices definidos en los esquemas con los presentes.
// No crea, modifica ni elimina índices, colecciones ni documentos. Uso:
//   node scripts/verify-indexes.js            (usa MONGO_URI / MONGODB_URI y MONGO_DB_NAME)
// Código de salida: 0 sin discrepancias, 1 con discrepancias, 2 error de conexión/ejecución.
import "dotenv/config";
import mongoose from "mongoose";
import { CODE_INDEX_NAME } from "../utils/product-code.js";
import { compareIndexes, specsFromSchema } from "../utils/index-verifier.js";

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
	console.error("Falta MONGO_URI o MONGODB_URI. No se usa ninguna base por defecto.");
	process.exit(2);
}

async function loadModels() {
	await import("../data/products.store.js");
	await import("../data/customers.store.js");
	// Registra el modelo Quotation (dependencia compartida); no se ejecuta ninguna lógica de cotizaciones.
	await import("../controllers/cotizar.controller.js");
	return ["Product", "Quotation", "Customer"].map((name) => mongoose.models[name]).filter(Boolean);
}

function maskHost(connection) {
	return `${connection.host || "?"}:${connection.port || ""}/${connection.name || ""}`;
}

const connection = mongoose.createConnection(uri, {
	dbName: process.env.MONGO_DB_NAME || undefined,
	autoIndex: false,
	autoCreate: false,
	serverSelectionTimeoutMS: 8000
});

try {
	const models = await loadModels();
	await connection.asPromise();
	const expected = {};
	for (const model of models) {
		const extra = model.modelName === "Product"
			? [{ name: CODE_INDEX_NAME, key: { codigo: 1 }, unique: true }]
			: [];
		expected[model.collection.name] = specsFromSchema(model.schema, extra);
	}
	const existing = new Set((await connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
	const present = {};
	for (const name of Object.keys(expected)) {
		present[name] = existing.has(name) ? await connection.db.collection(name).indexes() : null;
	}
	const report = compareIndexes(expected, present);
	console.log(`Base verificada: ${maskHost(connection)}`);
	for (const [name, specs] of Object.entries(expected)) {
		console.log(`- ${name}: ${specs.length} índices requeridos, ${present[name] ? present[name].length : 0} presentes`);
	}
	if (report.length === 0) {
		console.log("Sin discrepancias.");
	} else {
		console.log(`Discrepancias (${report.length}):`);
		for (const item of report) console.log(JSON.stringify(item));
	}
	process.exitCode = report.length ? 1 : 0;
} catch (error) {
	console.error(`Error del verificador: ${error.message.replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb://***@")}`);
	process.exitCode = 2;
} finally {
	await connection.close();
}
