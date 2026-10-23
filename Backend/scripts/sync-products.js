import 'dotenv/config';

import { disconnectProductsDatabase, syncSeedProducts } from '../data/products.store.js';

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vgv';
const localMongoUri = /^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i;

try {
	if (process.env.VERCEL || process.env.NODE_ENV === 'production' || !localMongoUri.test(mongoUri)) {
		throw new Error('La sincronización seed solo puede ejecutarse contra MongoDB local fuera de producción.');
	}
	if (process.argv.includes('--remove-missing')) {
		throw new Error('La opción --remove-missing está deshabilitada.');
	}
	const products = await syncSeedProducts();
	console.log(`Seed sincronizado correctamente. Total productos: ${products.length}`);
} catch (error) {
	console.error('No se pudo sincronizar el seed de productos:', error.message);
	process.exitCode = 1;
} finally {
	if (process.env.VERCEL !== '1') await disconnectProductsDatabase();
}
