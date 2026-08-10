<script>
  import { browser } from '$app/environment';
  const { titulo = "Catálogo VGV" } = $props();
  import { resolve } from '$app/paths';

  function volverAlInicio() {
    if (!browser) return;

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = '/index.html';
  }
</script>

<nav class="nav">
  <div class="logo">{titulo}</div>

  <div class="links">
    <button class="link-btn" type="button" onclick={volverAlInicio}>Volver al inicio</button>
    <a href={resolve('/catalogo')}>Catálogo</a>
    <a href={resolve('/carrito')}>Carrito</a>
  </div>
</nav>

<style>
  .nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: var(--vgv-azul-oscuro);
    color: var(--vgv-blanco);
  }

  .logo {
    font-size: 1.3rem;
    font-weight: bold;
  }

  .links a {
    margin-left: 1.5rem;
    color: var(--vgv-blanco);
    text-decoration: none;
    font-weight: 600;
  }

  .link-btn {
    margin-left: 1.5rem;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.35);
    color: var(--vgv-blanco);
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
  }

  .link-btn:hover {
    color: var(--vgv-verde);
    border-color: var(--vgv-verde);
  }

  .links a:hover {
    color: var(--vgv-verde);
  }

  @media (max-width: 700px) {
    .nav {
      flex-direction: column;
      gap: 0.75rem;
      align-items: flex-start;
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .links a,
    .link-btn {
      margin-left: 0;
    }
  }
</style>

