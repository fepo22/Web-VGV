import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'vgv_cart';

function createCartStore() {
  const initialValue = browser
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    : [];

  const { subscribe, set, update } = writable(initialValue);

  if (browser) {
    subscribe(value => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    });
  }

  return {
    subscribe,
    agregar(producto) {
      update(items => {
        const existing = items.find(item => item.id === producto.id);

        if (existing) {
          return items.map(item =>
            item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
          );
        }

        return [...items, { ...producto, cantidad: 1 }];
      });
    },
    eliminar(id) {
      update(items => items.filter(item => item.id !== id));
    },
    actualizarCantidad(id, cantidad) {
      update(items =>
        items.map(item =>
          item.id === id ? { ...item, cantidad: Math.max(1, cantidad) } : item
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
