import { productos } from '$lib/data/productos.js';

export async function GET() {
  return new Response(JSON.stringify(productos), {
    headers: {
      'content-type': 'application/json'
    }
  });
}
