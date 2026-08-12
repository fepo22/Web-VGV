<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	const slides = [
		{
			image: '/assets/Banners/banner1.jpg',
			alt: 'Fachada VGV con marcas de proveedores',
			title: 'Materiales de construcción para proyectos que duran',
			description: '+9 años de experiencia en Talcahuano',
			ctaHref: '/catalogo',
			ctaText: 'Ver catálogo',
			secondaryHref: 'mailto:ventas@vgv.cl',
			secondaryText: 'Cotizar ahora'
		},
		{
			image: '/assets/Banners/banner2.jpg',
			alt: 'Calefactores y radiadores para el hogar',
			title: 'Calefactores y radiadores de alto rendimiento',
			description: 'Soluciones de calefacción para hogar y proyecto.',
			ctaHref: '/catalogo?linea=calefont-calefaccion',
			ctaText: 'Ver calefacción'
		},
		{
			image: '/assets/Banners/Banner3.jpg',
			alt: 'Línea de calefacción y accesorios VGV',
			title: 'Calefont, radiadores y accesorios de instalación',
			description: 'Asesoría técnica especializada',
			ctaHref: '/catalogo?linea=calefont-calefaccion',
			ctaText: 'Ver calefacción'
		}
	];

	let activeSlide = $state(0);
	let carouselTrack;
	let btnTopVisible = $state(false);
	let autoSlideInterval;
	let autoCarouselInterval;

	function showSlide(index) {
		activeSlide = (index + slides.length) % slides.length;
	}

	function nextSlide() {
		showSlide(activeSlide + 1);
	}

	function moveCarousel(direction) {
		if (!carouselTrack || !carouselTrack.children.length) return;
		const first = carouselTrack.children[0];
		const styles = getComputedStyle(carouselTrack);
		const gap = Number.parseFloat(styles.gap || styles.columnGap || '0') || 0;
		const step = first.getBoundingClientRect().width + gap;
		if (!step) return;
		carouselTrack.scrollBy({ left: direction * step, behavior: 'smooth' });
	}

	onMount(() => {
		const onScroll = () => {
			btnTopVisible = window.scrollY > 300;
		};

		window.addEventListener('scroll', onScroll);
		autoSlideInterval = setInterval(nextSlide, 5000);
		autoCarouselInterval = setInterval(() => moveCarousel(1), 3000);

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) entry.target.classList.add('visible');
				});
			},
			{ threshold: 0.2 }
		);

		document.querySelectorAll('section, .card, .stat').forEach((el) => {
			el.classList.add('fade-in');
			observer.observe(el);
		});

		return () => {
			window.removeEventListener('scroll', onScroll);
			clearInterval(autoSlideInterval);
			clearInterval(autoCarouselInterval);
			observer.disconnect();
		};
	});
</script>

<svelte:head>
	<title
		>VGV SPA | Calefacción, Canalización y Materiales de construccion en Talcahuano, bio bio
		Concepcion</title
	>
	<meta
		name="description"
		content="VGV SPA ofrece calefont, radiadores, tuberías, griferías, accesorios y soluciones técnicas en Talcahuano. Cotiza rápido por WhatsApp o correo."
	/>
	<link rel="canonical" href="https://www.vgv.cl/" />
	<link rel="stylesheet" href="/style/base.css" />
	<link rel="stylesheet" href="/style/layout.css" />
	<link rel="stylesheet" href="/style/utils.css" />
	<link rel="stylesheet" href="/style/index.css" />
	<link rel="stylesheet" href="/style/proveedores.css" />
</svelte:head>

<header>
	<nav>
		<div class="logo">
			<a href={resolve('/')}>
				<img
					src="/assets/Logo-preview.png"
					alt="Logo VGV SPA"
					width="220"
					height="72"
					decoding="async"
					fetchpriority="high"
				/>
			</a>
		</div>
		<ul>
			<li><a href={resolve('/catalogo?linea=todas&ofertas=1')}>Ofertas</a></li>
			<li><a href={resolve('/catalogo')}>Catálogo</a></li>
			<li><a href={resolve('/catalogo')}>Quiénes somos</a></li>
			<li><a href={resolve('/contacto')}>Contacto</a></li>
		</ul>
	</nav>
</header>

<section class="banner-slider">
	{#each slides as slide, index (slide.image)}
		<div class="slide slide--{index + 1} {activeSlide === index ? 'active' : ''}">
			<img
				class="slide-bg"
				src={slide.image}
				alt={slide.alt}
				width="1920"
				height="760"
				loading={index === 0 ? 'eager' : 'lazy'}
				decoding="async"
				fetchpriority={index === 0 ? 'high' : 'low'}
			/>
			<div class="banner-content">
				<h1>{slide.title}</h1>
				<p>{slide.description}</p>
				<a href={resolve(slide.ctaHref)} class="btn">{slide.ctaText}</a>
				{#if slide.secondaryHref}
					<a href="mailto:ventas@vgv.cl" class="btn">{slide.secondaryText}</a>
				{/if}
			</div>
		</div>
	{/each}
	<div class="banner-dots" aria-label="Navegación del banner">
		{#each slides as slide, index (slide.image)}
			<button
				class="dot {activeSlide === index ? 'active' : ''}"
				type="button"
				aria-label={`Ir al banner ${index + 1}`}
				onclick={() => showSlide(index)}
			></button>
		{/each}
	</div>
</section>

<section class="stats">
	<div class="stat">
		<strong>+9</strong>
		<p>Años en el mercado</p>
	</div>
	<div class="stat">
		<strong>+500</strong>
		<p>Clientes atendidos</p>
	</div>
	<div class="stat">
		<strong>+200</strong>
		<p>Obras fidelizadas</p>
	</div>
</section>

<section class="productos-titulo">
	<h2>Nuestras líneas de producto</h2>
</section>

<section id="catalogo" class="catalogo">
	<div class="grid">
		<a href={resolve('/catalogo?linea=canalizacion')} class="card">
			<img
				src="/assets/icons/canalizacion.png"
				alt="Canalización de aguas"
				width="96"
				height="96"
				loading="lazy"
				decoding="async"
				fetchpriority="low"
			/>
			<h3>Canalización</h3>
			<p>Tuberías, codos, uniones y accesorios PVC y HDPE.</p>
		</a>
		<a href={resolve('/catalogo?linea=pegamentos-cementos')} class="card">
			<img
				src="/assets/icons/pegamentos.png"
				alt="Pegamentos y cementos"
				width="96"
				height="96"
				loading="lazy"
				decoding="async"
				fetchpriority="low"
			/>
			<h3>Pegamentos y cementos</h3>
			<p>Adhesivos industriales, cementos de contacto y sellantes.</p>
		</a>
		<a href={resolve('/catalogo?linea=griferias-sanitarios')} class="card">
			<img
				src="/assets/icons/griferias.png"
				alt="Griferías y sanitarios"
				width="96"
				height="96"
				loading="lazy"
				decoding="async"
				fetchpriority="low"
			/>
			<h3>Griferías y sanitarios</h3>
			<p>Llaves, grifos, WC y lavamanos.</p>
		</a>
		<a href={resolve('/catalogo?linea=calefont-calefaccion')} class="card">
			<img
				src="/assets/icons/calefaccion.png"
				alt="Calefont y calefacción"
				width="96"
				height="96"
				loading="lazy"
				decoding="async"
				fetchpriority="low"
			/>
			<h3>Calefont y calefacción</h3>
			<p>Calefont a gas, radiadores y accesorios de instalación.</p>
		</a>
	</div>
</section>

<section class="carrusel-productos">
	<h2>Productos Destacados</h2>
	<div class="carousel-container">
		<button class="carousel-btn left" type="button" onclick={() => moveCarousel(-1)}>&#8249;</button
		>
		<div class="carousel-track" bind:this={carouselTrack}>
			<div class="product-card">
				<img
					src="/assets/Carousel/canaleta_blanca.png"
					alt="Canaleta PVC Blanca"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Canaleta PVC Blanca</h3>
				<p>&nbsp;</p>
				<a class="btn-agregar" href={resolve('/producto/1')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/drenpro.png"
					alt="Tubería DrenPro"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Tubería DrenPro</h3>
				<p>6Mts x 250mm (consultar otras medidas)</p>
				<a class="btn-agregar" href={resolve('/producto/2')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/hdpe.png"
					alt="Tubo HDPE"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Tubo HDPE</h3>
				<p>Consultar medidas disponibles</p>
				<a class="btn-agregar" href={resolve('/producto/3')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/colector.png"
					alt="Tubo Colector"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Tubo Colector</h3>
				<p>Sn4-Sn8 (consultar medidas disponibles)</p>
				<a class="btn-agregar" href={resolve('/producto/4')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/tubo_cobre.png"
					alt="Cañería de Cobre"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Cañería de Cobre</h3>
				<p>Consulte stock y medidas</p>
				<a class="btn-agregar" href={resolve('/producto/5')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/Peg_montaje.png"
					alt="Adhesivo de Montaje"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Sin clavos ni tornillos</h3>
				<p>Adhesivo de montaje Soudal</p>
				<a class="btn-agregar" href={resolve('/producto/6')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/sika_ceram.png"
					alt="Pegamento Cerámico"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Pegamento cerámico y porcelanato</h3>
				<p>Adhesivo para cerámica y porcelanato</p>
				<a class="btn-agregar" href={resolve('/producto/7')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/Silirub_ac.png"
					alt="Silirub AC"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Silirub AC</h3>
				<p>Silicona acética</p>
				<a class="btn-agregar" href={resolve('/producto/8')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/adesilex.png"
					alt="Adesilex P9"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Adesilex P9</h3>
				<p>Aditivo para concreto</p>
				<a class="btn-agregar" href={resolve('/producto/9')}>Ver producto</a>
			</div>
			<div class="product-card">
				<img
					src="/assets/Carousel/termo.png"
					alt="Termo Eléctrico Muro"
					width="240"
					height="240"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>Termo eléctrico muro</h3>
				<p>Termo eléctrico para muros</p>
				<a class="btn-agregar" href={resolve('/producto/10')}>Ver producto</a>
			</div>
		</div>
		<button class="carousel-btn right" type="button" onclick={() => moveCarousel(1)}>&#8250;</button
		>
	</div>
</section>

<section class="ventajas">
	<h2>Por qué elegir VGV</h2>
	<ul>
		<li><strong>Calidad garantizada:</strong> Proveedores certificados y marcas líderes.</li>
		<li><strong>Entrega rápida:</strong> Despacho en la Región del Biobío.</li>
		<li><strong>Asesoría técnica:</strong> Te ayudamos a elegir el material correcto.</li>
	</ul>
</section>

<section class="proveedores-slider">
	<div class="slider-track">
		{#each [0, 1] as copyIdx (`copy-${copyIdx}`)}
			{#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as n (`${copyIdx}-${n}`)}
				<div class="slide">
					<img
						src={`/assets/proveedores/proveedor${n}.png`}
						alt={`Proveedor ${n}`}
						width="180"
						height="80"
						loading="lazy"
						decoding="async"
						fetchpriority="low"
					/>
				</div>
			{/each}
		{/each}
	</div>
</section>

<footer>
	<p>© 2016 VGV SPA — Comercializadora y distribuidora, Talcahuano</p>
</footer>

{#if btnTopVisible}
	<button id="btnTop" type="button" onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
		>↑</button
	>
{/if}
