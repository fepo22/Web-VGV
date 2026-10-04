<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { familias } from '$lib/data/categorias.js';

	const familiasPortada = familias.filter((familia) => familia.slug !== 'consumibles-obra');

	const familiaImagenes = {
		'canalizacion-tuberia': '/assets/icons/canalizacion.png',
		'pegamentos-cementos': '/assets/icons/pegamentos.png',
		'bano-cocina': '/assets/icons/griferias.png',
		calefaccion: '/assets/icons/calefaccion.png'
	};

	const bannerFiles = import.meta.glob('/static/assets/Banners/*.{jpg,jpeg,png,JPG,JPEG,PNG}', {
		eager: true,
		query: '?url',
		import: 'default'
	});

	const bannerContent = {
		banner1: {
			alt: 'Fachada VGV con marcas de proveedores',
			title: 'Materiales de construcción para proyectos que duran',
			description: 'Soluciones y asesoría para tu proyecto en Talcahuano.',
			ctaHref: '/catalogo',
			ctaText: 'Ver catálogo',
			secondaryHref: 'mailto:ventas@vgv.cl',
			secondaryText: 'Cotizar ahora'
		},
		banner2: {
			alt: 'VGV Punto Hidráulico',
			imageOnly: true
		},
		banner3: {
			alt: 'VGV Punto Hidráulico celebra 10 años conectando proyectos con confianza',
			anniversary: true
		}
	};

	// Discover actual files, keeping one image per basename (PNG > JPG > JPEG).
	const bannersByName = Object.create(null);
	const formatPriority = { png: 0, jpg: 1, jpeg: 2 };
	for (const path of Object.keys(bannerFiles).sort()) {
		const filename = path.split('/').pop();
		const name = filename.replace(/\.[^.]+$/, '');
		const extension = filename.split('.').pop().toLowerCase();
		const key = name.toLowerCase();
		const previous = bannersByName[key];
		if (!previous || formatPriority[extension] < formatPriority[previous.extension]) {
			bannersByName[key] = { name, extension, image: path.replace(/^\/static\//, '/') };
		}
	}
	const slides = Object.entries(bannersByName)
		.sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
		.map(([key, banner]) => ({
			image: banner.image,
			...(bannerContent[key] ?? { alt: `VGV · ${banner.name}`, imageOnly: true })
		}));

	let activeSlide = $state(0);
	const productosDestacados = [
		{ id: 1, image: 'canaleta_blanca.png', title: 'Canaleta PVC Blanca', description: '' },
		{
			id: 2,
			image: 'drenpro.png',
			title: 'Tubería DrenPro',
			description: '6Mts x 250mm (consultar otras medidas)'
		},
		{ id: 3, image: 'hdpe.png', title: 'Tubo HDPE', description: 'Consultar medidas disponibles' },
		{
			id: 4,
			image: 'colector.png',
			title: 'Tubo Colector',
			description: 'Sn4-Sn8 (consultar medidas disponibles)'
		},
		{
			id: 5,
			image: 'tubo_cobre.png',
			title: 'Cañería de Cobre',
			description: 'Consulte stock y medidas'
		},
		{
			id: 6,
			image: 'Peg_montaje.png',
			title: 'Sin clavos ni tornillos',
			description: 'Adhesivo de montaje Soudal'
		},
		{
			id: 7,
			image: 'sika_ceram.png',
			title: 'Pegamento cerámico y porcelanato',
			description: 'Adhesivo para cerámica y porcelanato'
		},
		{ id: 8, image: 'Silirub_ac.png', title: 'Silirub AC', description: 'Silicona acética' },
		{ id: 9, image: 'adesilex.png', title: 'Adesilex P9', description: 'Aditivo para concreto' },
		{
			id: 10,
			image: 'termo.png',
			title: 'Termo eléctrico muro',
			description: 'Termo eléctrico para muros'
		}
	];
	let carouselTrack;
	let btnTopVisible = $state(false);
	let autoSlideInterval;
	let autoCarouselInterval;
	let carouselScrollTimeout;
	let carouselMoving = false;
	let carouselHovered = false;
	let carouselFocused = false;
	let carouselDragging = false;
	let bannerHovered = false;
	let bannerFocused = false;
	let carouselStep = 0;
	let carouselCycle = 0;
	let reducedMotion;

	function showSlide(index, manual = true) {
		if (slides.length < 2) return;
		activeSlide = (index + slides.length) % slides.length;
		if (manual) {
			clearInterval(autoSlideInterval);
			autoSlideInterval = setInterval(nextSlide, 5000);
		}
	}

	function nextSlide() {
		if (!document.hidden && !reducedMotion.matches && !bannerHovered && !bannerFocused) {
			showSlide(activeSlide + 1, false);
		}
	}

	// Recenter between identical sets only when scrolling stops, without reversing direction.
	function normalizeCarousel() {
		if (!carouselCycle || carouselDragging) return;
		const left = carouselTrack.scrollLeft;
		if (left < carouselCycle - 1 || left >= carouselCycle * 2 - 1) {
			const offset = ((left % carouselCycle) + carouselCycle) % carouselCycle;
			carouselTrack.scrollTo({ left: carouselCycle + offset, behavior: 'instant' });
		}
	}

	function finishCarouselScroll() {
		clearTimeout(carouselScrollTimeout);
		carouselMoving = false;
		normalizeCarousel();
	}

	function onCarouselScroll() {
		clearTimeout(carouselScrollTimeout);
		// Fallback for browsers without scrollend support.
		carouselScrollTimeout = setTimeout(finishCarouselScroll, 180);
	}

	function measureCarousel() {
		const cards = carouselTrack.children;
		if (cards.length < productosDestacados.length * 3) return;
		const previousStep = carouselStep;
		const position = previousStep
			? carouselTrack.scrollLeft / previousStep
			: productosDestacados.length;
		carouselStep = cards[1].offsetLeft - cards[0].offsetLeft;
		carouselCycle = cards[productosDestacados.length].offsetLeft - cards[0].offsetLeft;
		if (previousStep !== carouselStep) {
			carouselTrack.scrollTo({ left: position * carouselStep, behavior: 'instant' });
			finishCarouselScroll();
		}
	}

	function moveCarousel(direction) {
		if (!carouselStep || carouselMoving || carouselDragging) return;
		normalizeCarousel();
		carouselMoving = true;
		const target = (Math.round(carouselTrack.scrollLeft / carouselStep) + direction) * carouselStep;
		carouselTrack.scrollTo({
			left: target,
			behavior: reducedMotion.matches ? 'instant' : 'smooth'
		});
		onCarouselScroll();
	}

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		measureCarousel();
		const resizeObserver = new ResizeObserver(measureCarousel);
		resizeObserver.observe(carouselTrack);
		const onPointerDown = () => {
			carouselDragging = true;
		};
		const onPointerUp = () => {
			carouselDragging = false;
			onCarouselScroll();
		};
		const onScroll = () => {
			btnTopVisible = window.scrollY > 300;
		};

		window.addEventListener('scroll', onScroll);
		carouselTrack.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
		if (slides.length > 1) autoSlideInterval = setInterval(nextSlide, 5000);
		autoCarouselInterval = setInterval(() => {
			if (
				!document.hidden &&
				!reducedMotion.matches &&
				!carouselHovered &&
				!carouselFocused &&
				!carouselDragging
			) {
				const rect = carouselTrack.getBoundingClientRect();
				if (rect.bottom > 0 && rect.top < window.innerHeight) moveCarousel(1);
			}
		}, 3000);

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) entry.target.classList.add('visible');
				});
			},
			{ threshold: 0.2 }
		);

		document.querySelectorAll('section:not(.banner-slider), .card').forEach((el) => {
			el.classList.add('fade-in');
			observer.observe(el);
		});

		return () => {
			window.removeEventListener('scroll', onScroll);
			carouselTrack.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('pointercancel', onPointerUp);
			clearInterval(autoSlideInterval);
			clearInterval(autoCarouselInterval);
			clearTimeout(carouselScrollTimeout);
			resizeObserver.disconnect();
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
			<li><a href={resolve('/catalogo')}>Catálogo</a></li>
			<li><a href={resolve('/cuenta')}>Mi cuenta</a></li>
			<li><a href={resolve('/quienes-somos')}>Quiénes somos</a></li>
			<li><a href={resolve('/contacto')}>Contacto</a></li>
		</ul>
	</nav>
</header>

{#if slides.length}
	<section
		class="banner-slider"
		aria-label="Novedades VGV"
		onmouseenter={() => (bannerHovered = true)}
		onmouseleave={() => (bannerHovered = false)}
		onfocusin={() => (bannerFocused = true)}
		onfocusout={(event) => (bannerFocused = event.currentTarget.contains(event.relatedTarget))}
	>
		{#each slides as slide, index (slide.image)}
			<div
				class="slide slide--{index + 1} {activeSlide === index ? 'active' : ''}"
				class:anniversary={slide.anniversary || slide.imageOnly}
				aria-hidden={activeSlide !== index}
				inert={activeSlide !== index}
			>
				<img
					class="slide-bg"
					src={slide.image}
					alt={slide.alt}
					width={index === 0 ? 4083 : index === 1 ? 3780 : 1920}
					height={index === 0 ? 2054 : index === 1 ? 1890 : 640}
					loading="eager"
					decoding="async"
					fetchpriority={index === 0 ? 'high' : 'low'}
				/>
				{#if !slide.anniversary && !slide.imageOnly}
					<div class="banner-content">
						<h1>{slide.title}</h1>
						<p>{slide.description}</p>
						<a href={resolve(slide.ctaHref)} class="btn">{slide.ctaText}</a>
						{#if slide.secondaryHref}
							<a href={slide.secondaryHref} rel="external" class="btn">{slide.secondaryText}</a>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
		{#if slides.length > 1}
			<button
				class="banner-arrow banner-arrow--prev"
				type="button"
				aria-label="Banner anterior"
				onclick={() => showSlide(activeSlide - 1)}
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="m14 6-6 6 6 6"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			<button
				class="banner-arrow banner-arrow--next"
				type="button"
				aria-label="Banner siguiente"
				onclick={() => showSlide(activeSlide + 1)}
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="m10 6 6 6-6 6"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			<div class="banner-dots" aria-label="Navegación del banner">
				{#each slides as slide, index (slide.image)}
					<button
						class="dot {activeSlide === index ? 'active' : ''}"
						type="button"
						aria-label={`Ir al banner ${index + 1}`}
						aria-pressed={activeSlide === index}
						onclick={() => showSlide(index)}
					></button>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<section class="productos-titulo">
	<h2>Nuestras líneas de producto</h2>
</section>

<section id="catalogo" class="catalogo">
	<div class="grid">
		{#each familiasPortada as familia (familia.slug)}
			<a href={resolve(`/catalogo?familia=${familia.slug}`)} class="card">
				<img
					src={familiaImagenes[familia.slug]}
					alt={familia.nombre}
					width="96"
					height="96"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
				/>
				<h3>{familia.nombre}</h3>
				<p>
					{familia.subfamilias
						.slice(0, 3)
						.map((item) => item.nombre)
						.join(' · ')}
				</p>
			</a>
		{/each}
	</div>
</section>

<section
	class="carrusel-productos"
	aria-label="Productos destacados"
	onmouseenter={() => (carouselHovered = true)}
	onmouseleave={() => (carouselHovered = false)}
	onfocusin={() => (carouselFocused = true)}
	onfocusout={(event) => (carouselFocused = event.currentTarget.contains(event.relatedTarget))}
>
	<h2>Productos Destacados</h2>
	<div class="carousel-container">
		<button
			class="carousel-btn left"
			type="button"
			aria-label="Producto anterior"
			onclick={() => moveCarousel(-1)}>&#8249;</button
		>
		<div
			class="carousel-track"
			bind:this={carouselTrack}
			onscroll={onCarouselScroll}
			onscrollend={finishCarouselScroll}
		>
			{#each [0, 1, 2] as copy (copy)}
				{#each productosDestacados as producto (`${copy}-${producto.id}`)}
					<div class="product-card" aria-hidden={copy !== 1}>
						<img
							src={`/assets/Carousel/${producto.image}`}
							alt={producto.title}
							width="240"
							height="240"
							loading="lazy"
							decoding="async"
							fetchpriority="low"
						/>
						<h3>{producto.title}</h3>
						<p>{producto.description || '\u00a0'}</p>
						<a
							class="btn-agregar"
							href={resolve(`/producto/${producto.id}`)}
							tabindex={copy === 1 ? 0 : -1}>Ver producto</a
						>
					</div>
				{/each}
			{/each}
		</div>
		<button
			class="carousel-btn right"
			type="button"
			aria-label="Producto siguiente"
			onclick={() => moveCarousel(1)}>&#8250;</button
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

<style>
	header nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 2rem;
	}

	header nav ul {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 1.8rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	header .logo img {
		height: 55px;
		width: auto;
	}

	@media (max-width: 700px) {
		header nav {
			flex-direction: column;
			align-items: flex-start;
		}

		header nav ul {
			width: 100%;
			gap: 0.4rem;
		}
	}
</style>
