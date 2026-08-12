import 'dotenv/config';

import { disconnectProductsDatabase, syncSeedProducts } from '../data/products.store.js';

const removeMissing = process.argv.includes('--remove-missing');

try {
	const products = await syncSeedProducts({ removeMissing });
	console.log(`Seed sincronizado correctamente. Total productos: ${products.length}`);
} catch (error) {
	console.error('No se pudo sincronizar el seed de productos:', error);
	process.exitCode = 1;
} finally {
	await disconnectProductsDatabase();
}
