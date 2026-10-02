import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'vgv_cart_v2';
const LEGACY_STORAGE_KEY = 'vgv_cart';
const CART_TTL_MS = 24 * 60 * 60 * 1000;

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
	const empty = { items: [], expiresAt: null };
	if (!browser) return empty;
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		localStorage.removeItem(LEGACY_STORAGE_KEY);
		if (saved !== null) {
			const stored = JSON.parse(saved);
			if (!Array.isArray(stored?.items) || !Number.isFinite(stored.expiresAt) || stored.expiresAt <= Date.now() || stored.expiresAt - Date.now() > CART_TTL_MS) {
				localStorage.removeItem(STORAGE_KEY);
				return empty;
			}
			return { items: stored.items.filter(Boolean).map(normalizeCartItem), expiresAt: stored.expiresAt };
		}
		return empty;
	} catch {
		return empty;
	}
}

function countItems(items) {
	return items.reduce((total, item) => total + (item.cantidad || 1), 0);
}

function createCartStore() {
	const initial = readCart();
	const { subscribe, set, update } = writable(initial.items);
	let expiresAt = initial.expiresAt;
	let expirationTimer;

	function checkExpiration() {
		if (!browser) return;
		window.clearTimeout(expirationTimer);
		if (!expiresAt) return;
		if (Date.now() >= expiresAt) {
			expiresAt = null;
			set([]);
			return;
		}
		expirationTimer = window.setTimeout(checkExpiration, expiresAt - Date.now());
	}

	const persist = (value) => {
		if (!browser) return;
		try {
			if (value.length === 0) {
				expiresAt = null;
				localStorage.removeItem(STORAGE_KEY);
			} else {
				expiresAt ??= Date.now() + CART_TTL_MS;
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: value, expiresAt }));
			}
			checkExpiration();
		} catch {
			// El carrito sigue disponible durante esta sesión si el navegador bloquea el almacenamiento.
		}
	};

	if (browser) {
		checkExpiration();
		let firstEmission = true;
		subscribe((value) => {
			if (firstEmission) {
				firstEmission = false;
				return;
			}
			persist(value);
		});
		window.addEventListener('focus', checkExpiration);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') checkExpiration();
		});
	}

	function updateFresh(callback) {
		checkExpiration();
		update(callback);
	}

	return {
		subscribe,
		agregar(producto) {
			updateFresh((items) => {
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
			checkExpiration();
			return countItems(readCart().items);
		},
		eliminar(cartKey) {
			updateFresh((items) => items.filter((item) => item.cartKey !== cartKey));
		},
		actualizarCantidad(cartKey, cantidad) {
			updateFresh((items) =>
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
