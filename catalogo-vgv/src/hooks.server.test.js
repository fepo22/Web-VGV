import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle } from './hooks.server.js';

test('server responses cannot be framed and retain other CSP directives', async () => {
	const response = await handle({
		event: {},
		resolve: async () =>
			new Response('ok', {
				headers: {
					'content-security-policy': "default-src 'self'; frame-ancestors https://attacker.example"
				}
			})
	});

	assert.equal(response.headers.get('x-frame-options'), 'DENY');
	assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
	assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
	assert.doesNotMatch(response.headers.get('content-security-policy'), /attacker\.example/);
});
