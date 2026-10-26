// Diagnóstico de códigos de producto, SOLO LECTURA. Solo ejecuta find con proyección { id, codigo } y listCollections.
// No crea índices ni colecciones, no escribe, no imprime credenciales ni otros campos del producto. Uso:
//   node scripts/diagnose-product-codes.js            (usa MONGO_URI / MONGODB_URI y MONGO_DB_NAME)
// Recomendado: usuario de base de datos con rol de solo lectura.
// Código de salida: 0 sin hallazgos, 1 con hallazgos, 2 error de conexión/ejecución.
import "dotenv/config";
import mongoose from "mongoose";
import { analyzeProductCodes } from "../utils/product-code-diagnosis.js";

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) {
	console.error("Falta MONGO_URI o MONGODB_URI. No se usa ninguna base por defecto.");
	process.exit(2);
}

const connection = mongoose.createConnection(uri, {
	dbName: process.env.MONGO_DB_NAME || undefined,
	autoIndex: false,
	autoCreate: false,
	serverSelectionTimeoutMS: 8000
});

try {
	await connection.asPromise();
	const exists = (await connection.db.listCollections({ name: "products" }, { nameOnly: true }).toArray()).length > 0;
	console.log(`Base verificada: ${connection.host || "?"}:${connection.port || ""}/${connection.name || ""}`);
	if (!exists) {
		console.log("La colección products no existe: no hay códigos que diagnosticar.");
	} else {
		const products = await connection.db.collection("products")
			.find({}, { projection: { _id: 0, id: 1, codigo: 1 } }).toArray();
		const result = analyzeProductCodes(products);
		console.log(JSON.stringify(result.counts, null, 2));
		console.log(`Bloquea altas/cambios de código (CODE_HISTORY_REVIEW_REQUIRED): ${result.blocksCodeWrites ? "SÍ" : "no"}`);
		console.log(`Veredicto para crear el índice único: ${result.uniqueIndexVerdict.toUpperCase()}${result.uniqueIndexVerdict === "indeterminado" ? " (hay valores cuya semántica en MongoDB no se reproduce con certeza; no asumir que es seguro)" : ""}`);
		console.log(`Colisiones tras normalizar: ${result.counts.normalizedCollisionGroups ? "SÍ" : "no"}`);
		for (const [name, list] of Object.entries(result.samples)) {
			if (list.length) console.log(`\n${name} (primeros ${list.length}):\n${JSON.stringify(list, null, 2)}`);
		}
		const findings = result.blocksCodeWrites || result.blocksUniqueIndex || result.counts.normalizedCollisionGroups > 0;
		process.exitCode = findings ? 1 : 0;
		if (!findings) console.log("Sin hallazgos.");
	}
} catch (error) {
	console.error(`Error del diagnóstico: ${error.message.replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb://***@")}`);
	process.exitCode = 2;
} finally {
	await connection.close();
}
