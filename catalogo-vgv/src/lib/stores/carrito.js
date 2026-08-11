import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'vgv_cart';

function countItems(items) {
	return items.reduce((total, item) => total + (item.cantidad || 1), 0);
}

function createCartStore() {
	const initialValue = browser ? JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') : [];

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

				return [...items, { ...producto, cartKey, cantidad: incremento }];
			});
		},
		getCount() {
			return countItems(browser ? JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') : []);
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

export function agregarAlCarrito(producto) {
	carrito.agregar(producto);
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
