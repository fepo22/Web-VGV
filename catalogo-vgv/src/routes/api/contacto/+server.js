import { env } from '$env/dynamic/private';

const BACKEND_URL = (env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:4000').replace(
	/\/$/,
	''
);

export async function POST({ request }) {
	try {
		const payload = await request.json();

		const respuesta = await fetch(`${BACKEND_URL}/api/contacto`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json'
			},
			body: JSON.stringify(payload)
		});

		const data = await respuesta.json().catch(() => ({ error: 'Respuesta invalida del servidor' }));

		return new Response(JSON.stringify(data), {
			status: respuesta.status,
			headers: {
				'content-type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Error enviando contacto al backend:', error);
		return new Response(
			JSON.stringify({ error: 'No se pudo conectar con el backend de contacto' }),
			{
				status: 502,
				headers: {
					'content-type': 'application/json'
				}
			}
		);
	}
}
