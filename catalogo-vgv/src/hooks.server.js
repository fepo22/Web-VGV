export async function handle({ event, resolve }) {
	const response = await resolve(event);
	const currentPolicy = response.headers.get('content-security-policy') ?? '';
	const policy = currentPolicy
		.split(';')
		.map((directive) => directive.trim())
		.filter((directive) => directive && !directive.toLowerCase().startsWith('frame-ancestors '))
		.concat("frame-ancestors 'none'")
		.join('; ');

	response.headers.set('content-security-policy', policy);
	response.headers.set('x-frame-options', 'DENY');
	return response;
}
