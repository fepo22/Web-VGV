<script>
	let { products = [], currentId = '', selectedIds = [], onchange = () => {} } = $props();
	let query = $state('');
	const available = $derived(
		products.filter((product) => String(product.id) !== String(currentId))
	);
	const selected = $derived(new Set(selectedIds.map(String)));
	const matches = $derived(
		available.filter((product) =>
			`${product.codigo || ''} ${product.nombre || ''}`
				.toLowerCase()
				.includes(query.trim().toLowerCase())
		)
	);
	const selectedProducts = $derived(
		selectedIds.map((id) => ({
			id,
			product: available.find((product) => String(product.id) === String(id))
		}))
	);

	function toggle(id, checked) {
		const next = checked
			? [...selectedIds, String(id)]
			: selectedIds.filter((entry) => String(entry) !== String(id));
		onchange([...new Set(next)]);
	}
</script>

<fieldset class="related-selector">
	<legend>Productos relacionados</legend>
	<p>
		Selecciona hasta 20 productos para recomendar en esta ficha. La asociación es de una sola
		dirección.
	</p>
	<label class="search"
		>Buscar por código o nombre
		<input type="search" bind:value={query} placeholder="Ej: VGV-0002 o adhesivo" />
	</label>
	<div class="selected-products" aria-label="Productos seleccionados">
		{#each selectedProducts as entry (entry.id)}
			<button
				type="button"
				onclick={() => toggle(entry.id, false)}
				aria-label={`Quitar ${entry.product?.nombre || entry.id}`}
			>
				{entry.product?.nombre || `Producto no disponible (${entry.id})`}
				<span aria-hidden="true">×</span>
			</button>
		{/each}
	</div>
	<p class="count" role="status">
		{selectedIds.length} / 20 seleccionados · {matches.length} coincidencias
	</p>
	<div class="options">
		{#each matches as product (product.id)}
			<label class="option">
				<input
					type="checkbox"
					checked={selected.has(String(product.id))}
					disabled={selectedIds.length >= 20 && !selected.has(String(product.id))}
					onchange={(event) => toggle(product.id, event.currentTarget.checked)}
				/>
				<span><strong>{product.nombre}</strong><small>{product.codigo || product.id}</small></span>
			</label>
		{:else}
			<p>No hay otros productos para esta búsqueda.</p>
		{/each}
	</div>
</fieldset>

<style>
	.related-selector {
		border: 1px solid var(--vgv-border-soft, #dbe3ec);
		border-radius: 14px;
		padding: 1rem;
		min-width: 0;
	}
	legend {
		font-weight: 800;
		color: var(--vgv-azul-oscuro, #173047);
		padding: 0 0.4rem;
	}
	p {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
	}
	.search {
		display: grid;
		gap: 0.4rem;
		font-weight: 700;
	}
	.search input {
		width: 100%;
	}
	.selected-products {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.75rem 0;
	}
	.selected-products button {
		border: 1px solid #b7d9ce;
		background: #eff8f4;
		border-radius: 999px;
		padding: 0.4rem 0.75rem;
		color: #174b3a;
		cursor: pointer;
	}
	.count {
		font-size: 0.85rem;
	}
	.options {
		max-height: 260px;
		overflow-y: auto;
		display: grid;
		gap: 0.25rem;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.6rem;
		border-radius: 8px;
		cursor: pointer;
	}
	.option:hover {
		background: #f3f7fb;
	}
	.option input {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		accent-color: #174b3a;
	}
	small {
		display: block;
		color: #637487;
	}
</style>
