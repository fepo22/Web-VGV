<script>
	import { page } from '$app/state';

	const SITE_URL = 'https://www.vgv.cl';

	const { title, description, image = '', type = 'website', jsonLd = null } = $props();

	const jsonLdTag = $derived(
		jsonLd
			? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}<\/script>`
			: ''
	);

	const url = $derived(`${SITE_URL}${page.url.pathname}`);
	const DEFAULT_IMAGE = '/assets/Logo-preview.png';
	const imageUrl = $derived.by(() => {
		const src = image || DEFAULT_IMAGE;
		return /^https?:\/\//i.test(src) ? src : `${SITE_URL}${src}`;
	});
</script>

<svelte:head>
	<meta property="og:site_name" content="VGV SPA" />
	<meta property="og:locale" content="es_CL" />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta name="twitter:card" content={imageUrl ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	{#if imageUrl}
		<meta property="og:image" content={imageUrl} />
		<meta name="twitter:image" content={imageUrl} />
	{/if}
	{#if jsonLdTag}{@html jsonLdTag}{/if}
</svelte:head>
