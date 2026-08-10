<script>
  import { carrito } from '$lib/stores/carrito.js';

  let items = $state([]);
  let enviado = $state(false);

  const datosBancarios = {
    banco: 'Banco de Chile',
    tipoCuenta: 'Cuenta Corriente',
    numeroCuenta: '00000000',
    rut: '00.000.000-0',
    razonSocial: 'VGV SPA',
    correo: 'ventas@vgv.cl'
  };

  $effect(() => {
    const unsub = carrito.subscribe(value => {
      items = value;
    });

    return () => unsub();
  });

  function total() {
    return items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  }

  function enviarFormulario(event) {
    event.preventDefault();
    enviado = true;
  }
</script>

<section class="checkout">
  <header class="cabecera">
    <h1>Finalizar compra</h1>
    <p>Completa tus datos para preparar el despacho y realizar tu transferencia bancaria.</p>
  </header>

  <div class="layout">
    <form class="formulario" onsubmit={enviarFormulario}>
      <h2>Datos del cliente</h2>

      <label for="nombre-apellido">Nombre y apellido</label>
      <input id="nombre-apellido" name="nombreApellido" type="text" required />

      <label for="empresa">Empresa</label>
      <input id="empresa" name="empresa" type="text" required />

      <label for="rut">RUT</label>
      <input id="rut" name="rut" type="text" placeholder="12.345.678-9" required />

      <label for="direccion">Direccion de despacho</label>
      <input id="direccion" name="direccion" type="text" required />

      <label for="contacto">Numero de contacto</label>
      <input id="contacto" name="contacto" type="tel" required />

      <label for="mail">Mail</label>
      <input id="mail" name="mail" type="email" required />

      <button class="btn-submit" type="submit">Enviar solicitud de compra</button>

      {#if enviado}
        <p class="ok">Solicitud enviada. En breve el equipo VGV te contactara para confirmar stock y despacho.</p>
      {/if}
    </form>

    <aside class="resumen">
      <h2>Resumen del pedido</h2>

      {#if items.length === 0}
        <p class="vacio">No hay productos en el carrito.</p>
      {:else}
        <ul class="lista">
          {#each items as item (item.id)}
            <li>
              <span>{item.nombre} x {item.cantidad}</span>
              <strong>${(item.precio * item.cantidad).toLocaleString('es-CL')}</strong>
            </li>
          {/each}
        </ul>

        <p class="total">Total referencial: <strong>${total().toLocaleString('es-CL')}</strong></p>
      {/if}

      <section class="banco">
        <h3>Datos bancarios de VGV (transferencia)</h3>
        <p><strong>Banco:</strong> {datosBancarios.banco}</p>
        <p><strong>Tipo de cuenta:</strong> {datosBancarios.tipoCuenta}</p>
        <p><strong>Numero de cuenta:</strong> {datosBancarios.numeroCuenta}</p>
        <p><strong>RUT:</strong> {datosBancarios.rut}</p>
        <p><strong>Razon social:</strong> {datosBancarios.razonSocial}</p>
        <p><strong>Correo de confirmacion:</strong> {datosBancarios.correo}</p>
      </section>
    </aside>
  </div>
</section>

<style>
  .checkout {
    padding: 1rem 0 2rem;
  }

  .cabecera h1 {
    margin: 0;
    color: var(--vgv-azul-oscuro);
  }

  .cabecera p {
    color: var(--vgv-gris);
    margin: 0.5rem 0 1.5rem;
  }

  .layout {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 1.4rem;
  }

  .formulario,
  .resumen {
    background: white;
    border: 1px solid #e7eef6;
    border-radius: 14px;
    padding: 1rem;
  }

  .formulario h2,
  .resumen h2 {
    margin: 0 0 1rem;
    color: var(--vgv-azul-oscuro);
    font-size: 1.2rem;
  }

  label {
    display: block;
    font-weight: 600;
    color: var(--vgv-azul-oscuro);
    margin: 0.7rem 0 0.35rem;
  }

  input {
    width: 100%;
  }

  .btn-submit {
    margin-top: 1rem;
    width: 100%;
    background: var(--vgv-verde);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 0.8rem 1rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-submit:hover {
    background: #3e8e41;
  }

  .ok {
    margin-top: 0.8rem;
    background: #ecfdf3;
    color: #166534;
    border: 1px solid #bbf7d0;
    border-radius: 10px;
    padding: 0.7rem;
  }

  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .lista li {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    border-bottom: 1px dashed #d9e5f2;
    padding-bottom: 0.45rem;
  }

  .total {
    margin-top: 0.9rem;
    color: var(--vgv-azul-oscuro);
  }

  .banco {
    margin-top: 1rem;
    border-top: 1px solid #e7eef6;
    padding-top: 0.9rem;
  }

  .banco h3 {
    margin: 0 0 0.6rem;
    color: var(--vgv-azul-oscuro);
    font-size: 1rem;
  }

  .banco p {
    margin: 0.25rem 0;
    color: var(--vgv-gris);
  }

  .vacio {
    color: var(--vgv-gris);
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
