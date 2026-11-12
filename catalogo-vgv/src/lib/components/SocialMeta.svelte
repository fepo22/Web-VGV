<script>
	import { page } from '$app/state';

	const SITE_URL = 'https://www.vgv.cl';

	const { title, description, image = '', type = 'website' } = $props();

	const url = $derived(`${SITE_URL}${page.url.pathname}`);
	const imageUrl = $derived(
		image ? (/^https?:\/\//i.test(image) ? image : `${SITE_URL}${image}`) : ''
	);
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
</svelte:head>
