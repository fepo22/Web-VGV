<script>
  import { resolve } from '$app/paths';
  import { carrito, actualizarCantidad, eliminarDelCarrito, vaciarCarrito } from '$lib/stores/carrito.js';

  let items = $state([]);

  $effect(() => {
    const unsub = carrito.subscribe(value => {
      items = value;
    });

    return () => unsub();
  });

  function total() {
    return items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  }
</script>

<section class="carrito">
  <h1>Carrito de Compras</h1>

  {#if items.length === 0}
    <p class="vacio">Tu carrito está vacío.</p>
  {:else}
    <div class="lista">
      {#each items as item (item.id)}
        <article class="item">
          <img src={item.imagen} alt={item.nombre} />

          <div class="info">
            <h3>{item.nombre}</h3>
            <p class="precio">${item.precio.toLocaleString('es-CL')}</p>

            <div class="controls">
              <button type="button" onclick={() => actualizarCantidad(item.id, item.cantidad - 1)}>-</button>
              <span>{item.cantidad}</span>
              <button type="button" onclick={() => actualizarCantidad(item.id, item.cantidad + 1)}>+</button>
            </div>

            <button class="eliminar" type="button" onclick={() => eliminarDelCarrito(item.id)}>
              Eliminar
            </button>
          </div>
        </article>
      {/each}
    </div>

    <div class="total">
      <h2>Total: ${total().toLocaleString('es-CL')}</h2>
      <a class="btn-pagar" href={resolve('/checkout')}>Finalizar compra</a>
      <button class="btn-vaciar" type="button" onclick={vaciarCarrito}>Vaciar carrito</button>
    </div>
  {/if}
</section>

<style>
  .carrito {
    padding: 1rem 0 2rem;
  }

  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--vgv-azul-oscuro);
    margin-bottom: 1.5rem;
  }

  .vacio {
    font-size: 1.2rem;
    color: var(--vgv-gris);
  }

  .lista {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    margin-bottom: 2rem;
  }

  .item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--vgv-gris-claro);
    border-radius: 8px;
    background: var(--vgv-blanco);
  }

  img {
    width: 120px;
    height: 120px;
    object-fit: contain;
    border-radius: 6px;
    background: var(--vgv-gris-claro);
  }

  .info h3 {
    margin: 0;
    color: var(--vgv-azul);
  }

  .precio {
    font-weight: 700;
    color: var(--vgv-verde);
  }

  .controls {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }

  .controls button {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--vgv-azul);
    color: white;
    cursor: pointer;
  }

  .eliminar {
    background: transparent;
    border: none;
    color: var(--vgv-azul);
    cursor: pointer;
    padding: 0;
  }

  .eliminar:hover {
    color: var(--vgv-azul-oscuro);
  }

  .total {
    border-top: 2px solid var(--vgv-gris-claro);
    padding-top: 1.5rem;
  }

  .btn-pagar {
    display: inline-block;
    background: var(--vgv-verde);
    color: var(--vgv-blanco);
    padding: 0.9rem 1.6rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    margin-right: 1rem;
  }

  .btn-pagar:hover {
    background: #3e8e41;
  }

  .btn-vaciar {
    background: var(--vgv-azul);
    color: var(--vgv-blanco);
    padding: 0.9rem 1.6rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-vaciar:hover {
    background: var(--vgv-azul-oscuro);
  }
</style>

