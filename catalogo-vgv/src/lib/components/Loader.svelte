<div class="loader"></div>

<style>
	.loader {
		width: 48px;
		height: 48px;
		border: 5px solid var(--vgv-gris-claro);
		border-top-color: var(--vgv-azul);
		border-right-color: var(--vgv-verde);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 2rem auto;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
