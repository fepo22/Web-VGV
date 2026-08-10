import { productos } from '$lib/data/productos.js';

export function load({ params }) {
  const producto = productos.find(item => item.id === params.id) ?? null;

  return {
    producto
  };
}
