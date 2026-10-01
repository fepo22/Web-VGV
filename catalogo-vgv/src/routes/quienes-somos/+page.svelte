<script>
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Quiénes somos | VGV SPA</title>
	<meta name="description" content="Conoce la historia, misión, visión y valores de VGV SPA. Soluciones en canalización y calefacción desde Talcahuano." />
	<link rel="canonical" href="https://www.vgv.cl/quienes-somos" />
</svelte:head>

<section class="hero" aria-labelledby="about-title">
	<img src="/assets/Banners/banner1.jpg" alt="Fachada de VGV SPA en Talcahuano" width="1600" height="900" fetchpriority="high" />
	<div class="hero-content">
		<p>Quiénes somos</p>
		<h1 id="about-title">VGV SPA</h1>
		<span>Soluciones en canalización, calefacción y materiales de construcción.</span>
	</div>
</section>

<section class="introduction" aria-labelledby="about-us">
	<p class="section-label">Desde Talcahuano</p>
	<h2 id="about-us">Sobre nosotros</h2>
	<h3>Nuestra historia</h3>
	<p>En VGV SPA comenzamos con un propósito claro: entregar soluciones confiables en canalización y calefacción. Con experiencia técnica y un compromiso constante con la innovación, hemos construido relaciones duraderas con nuestros clientes, ofreciendo calidad y eficiencia en cada proyecto.</p>
</section>

<section class="purpose" aria-label="Propósito de VGV SPA">
	<div>
		<p class="section-label">Lo que hacemos</p>
		<h2>Nuestra misión</h2>
		<p>Brindar productos y servicios de alta calidad, optimizando procesos logísticos mediante tecnología y gestión inteligente.</p>
	</div>
	<div>
		<p class="section-label">Hacia dónde vamos</p>
		<h2>Nuestra visión</h2>
		<p>Ser líderes en suministros técnicos y soluciones de calefacción, destacando por eficiencia, compromiso y atención personalizada.</p>
	</div>
</section>

<section class="values" aria-labelledby="values-title">
	<p class="section-label">Nuestra forma de trabajar</p>
	<h2 id="values-title">Valores</h2>
	<ul>
		<li><strong>Responsabilidad</strong><span>Compromiso y transparencia.</span></li>
		<li><strong>Calidad</strong><span>Productos certificados y garantizados.</span></li>
		<li><strong>Trabajo en equipo</strong><span>Crecimiento sostenible.</span></li>
	</ul>
</section>

<section class="visit" aria-labelledby="visit-title">
	<div>
		<p class="section-label">Hablemos de tu proyecto</p>
		<h2 id="visit-title">Estamos en Talcahuano</h2>
		<p>Alonso de Ojeda 215 · ventas@vgv.cl</p>
	</div>
	<a href={resolve('/contacto')}>Contáctanos</a>
</section>

<style>
	.hero { position: relative; height: min(54vh, 480px); min-height: 330px; overflow: hidden; background: var(--vgv-azul-oscuro); color: white; }
	.hero::after { content: ''; position: absolute; inset: 0; background: linear-gradient(0deg, rgba(4, 20, 27, 0.88), rgba(4, 20, 27, 0.04) 75%); }
	.hero img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 46%; }
	.hero-content { position: absolute; z-index: 1; bottom: 2rem; left: clamp(1.25rem, 4%, 3rem); right: 1.25rem; }
	.hero-content p { margin: 0 0 0.25rem; font-weight: 700; }
	.hero h1 { margin: 0 0 0.35rem; font-size: 2.75rem; line-height: 1.1; }
	.hero-content span { display: block; max-width: 38rem; line-height: 1.5; }
	.introduction, .purpose, .values, .visit { padding: 2.6rem 0; }
	.section-label { margin: 0 0 0.55rem; color: var(--vgv-verde-oscuro); font-size: 0.82rem; font-weight: 800; text-transform: uppercase; }
	h2 { color: var(--vgv-azul-oscuro); font-size: 1.55rem; margin: 0 0 0.8rem; }
	h3 { color: var(--vgv-azul-oscuro); font-size: 1.1rem; margin: 1rem 0 0.45rem; }
	.introduction > p:last-child { max-width: 68ch; font-size: 1.1rem; line-height: 1.7; }
	.purpose { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2rem; border-top: 1px solid var(--vgv-gris-claro); border-bottom: 1px solid var(--vgv-gris-claro); }
	.purpose p:last-child, .visit p:last-child { line-height: 1.65; margin: 0; }
	.values ul { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; padding: 0; list-style: none; margin: 1.3rem 0 0; }
	.values li { display: grid; gap: 0.45rem; border-top: 3px solid var(--vgv-verde); padding-top: 1rem; }
	.values li span { line-height: 1.5; }
	.visit { display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; border-top: 1px solid var(--vgv-gris-claro); }
	.visit a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0.75rem 1.3rem; border-radius: 6px; background: var(--vgv-azul); color: white; font-weight: 700; text-decoration: none; white-space: nowrap; }
	.visit a:hover { background: var(--vgv-azul-oscuro); }
	@media (max-width: 700px) {
		.hero { height: 43vh; min-height: 300px; }
		.hero img { object-position: center 42%; }
		.hero h1 { font-size: 2.1rem; }
		.introduction, .purpose, .values, .visit { padding: 2rem 0; }
		.purpose, .values ul { grid-template-columns: 1fr; }
		.visit { align-items: flex-start; flex-direction: column; }
	}
</style>