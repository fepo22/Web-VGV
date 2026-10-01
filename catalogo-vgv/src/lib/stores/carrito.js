import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'vgv_cart';

function normalizeCartItem(item) {
	return {
		id: item.id,
		nombre: item.nombre,
		descripcion: item.descripcion,
		imagen: item.imagen,
		categoria: item.categoria,
		categoriaSlug: item.categoriaSlug,
		varianteSku: item.varianteSku,
		varianteMedida: item.varianteMedida,
		minima: item.minima,
		cartKey: item.cartKey || (item.varianteSku ? `${item.id}:${item.varianteSku}` : String(item.id)),
		cantidad: Math.max(1, Number(item.cantidad ?? 1))
	};
}

function readCart() {
	if (!browser) return [];
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(stored) ? stored.filter(Boolean).map(normalizeCartItem) : [];
	} catch {
		return [];
	}
}

function countItems(items) {
	return items.reduce((total, item) => total + (item.cantidad || 1), 0);
}

function createCartStore() {
	const initialValue = readCart();

	const { subscribe, set, update } = writable(initialValue);

	const persist = (value) => {
		if (!browser) return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	};

	if (browser) {
		subscribe((value) => {
			persist(value);
		});
	}

	return {
		subscribe,
		agregar(producto) {
			update((items) => {
				const cartKey =
					producto.cartKey ||
					(producto.varianteSku ? `${producto.id}:${producto.varianteSku}` : String(producto.id));
				const incremento = Math.max(1, Number(producto.cantidad ?? 1));
				const existing = items.find((item) => item.cartKey === cartKey);

				if (existing) {
					return items.map((item) =>
						item.cartKey === cartKey ? { ...item, cantidad: item.cantidad + incremento } : item
					);
				}

				return [...items, normalizeCartItem({ ...producto, cartKey, cantidad: incremento })];
			});
		},
		getCount() {
			return countItems(readCart());
		},
		eliminar(cartKey) {
			update((items) => items.filter((item) => item.cartKey !== cartKey));
		},
		actualizarCantidad(cartKey, cantidad) {
			update((items) =>
				items.map((item) =>
					item.cartKey === cartKey ? { ...item, cantidad: Math.max(1, cantidad) } : item
				)
			);
		},
		vaciar() {
			set([]);
		}
	};
}

export const carrito = createCartStore();
export const carritoLateralAbierto = writable(false);

export function agregarAlCarrito(producto) {
	carrito.agregar(producto);
	carritoLateralAbierto.set(true);
}

export function eliminarDelCarrito(id) {
	carrito.eliminar(id);
}

export function actualizarCantidad(id, cantidad) {
	carrito.actualizarCantidad(id, cantidad);
}

export function vaciarCarrito() {
	carrito.vaciar();
}
