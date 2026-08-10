import { writable } from 'svelte/store';

const STORAGE_KEY = 'vgv_carrito_v1';

// Rehidratar de localStorage solo en cliente
function loadInitial() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('No se pudo leer carrito desde localStorage', e);
    return [];
  }
}

const initial = loadInitial();
export const carrito = writable(initial);

// Persistir cambios (solo en cliente)
carrito.subscribe(value => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch (e) {
    console.warn('No se pudo guardar carrito en localStorage', e);
  }
});

export function agregarAlCarrito(producto) {
  carrito.update(items => {
    const existente = items.find(p => p.id === producto.id);

    if (existente) {
      return items.map(p =>
        p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p
      );
    }

    return [...items, { ...producto, cantidad: 1 }];
  });
}

export function eliminarDelCarrito(id) {
  carrito.update(items => items.filter(p => p.id !== id));
}

export function actualizarCantidad(id, cantidad) {
  carrito.update(items =>
    items.map(p => (p.id === id ? { ...p, cantidad: Math.max(1, cantidad) } : p))
  );
}

export function vaciarCarrito() {
  carrito.set([]);
}
