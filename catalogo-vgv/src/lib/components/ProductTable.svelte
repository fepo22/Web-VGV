<script>
	const { products = [], loadingId = '', onEdit, onToggleStatus, onDelete } = $props();
</script>

<div class="table-wrap">
	<table class="product-table">
		<thead>
			<tr>
				<th>Codigo</th>
				<th>Nombre</th>
				<th>Precio</th>
				<th>Oferta</th>
				<th>Stock</th>
				<th>Estado</th>
				<th>Acciones</th>
			</tr>
		</thead>
		<tbody>
			{#each products as product (product.id)}
				<tr>
					<td>
						<code>{product.codigo || `VGV-${String(product.id).padStart(4, '0')}`}</code>
					</td>
					<td>
						<strong>{product.nombre}</strong>
						<small>ID {product.id}</small>
					</td>
					<td>
						<strong>${Number(product.precio ?? 0).toLocaleString('es-CL')}</strong>
						{#if Number.isFinite(Number(product.precioDescuento)) && Number(product.precioDescuento) > 0}
							<small>Oferta: ${Number(product.precioDescuento).toLocaleString('es-CL')}</small>
						{/if}
					</td>
					<td>
						{#if Boolean(product.oferta) || (Number(product.precioDescuento) > 0 && Number(product.precioDescuento) < Number(product.precio ?? 0))}
							<span class="status-pill offer">En oferta</span>
						{:else}
							<span class="status-pill">Sin oferta</span>
						{/if}
					</td>
					<td>{Number(product.stock ?? 0)}</td>
					<td>
						<span class={`status-pill ${product.estado === 'disponible' ? 'available' : 'out'}`}>
							{product.estado === 'disponible' ? 'Disponible' : 'Sin stock'}
						</span>
					</td>
					<td>
						<div class="actions">
							<button type="button" class="btn-action" onclick={() => onEdit?.(product)}>
								Editar
							</button>
							<button
								type="button"
								class="btn-action"
								disabled={loadingId === `${product.id}-status`}
								onclick={() => onToggleStatus?.(product)}
							>
								{product.estado === 'disponible' ? 'Marcar sin stock' : 'Marcar disponible'}
							</button>
							<button
								type="button"
								class="btn-action secondary"
								disabled={loadingId === `${product.id}-delete`}
								onclick={() => onDelete?.(product)}
							>
								Eliminar
							</button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
		background: var(--vgv-surface);
		border: 1px solid var(--vgv-border-soft);
		border-radius: var(--vgv-radius-lg);
		box-shadow: var(--vgv-shadow-sm);
	}

	.product-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 760px;
	}

	th,
	td {
		padding: 0.95rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--vgv-border-soft);
		vertical-align: middle;
	}

	thead th {
		background: var(--vgv-gris-claro);
		color: var(--vgv-azul-oscuro);
		font-size: 0.92rem;
	}

	tbody tr:hover {
		background: var(--color-surface-tint);
	}

	td strong {
		display: block;
		color: var(--vgv-azul-oscuro);
	}

	td small {
		display: block;
		margin-top: 0.2rem;
		color: var(--vgv-gris);
	}

	td code {
		display: inline-flex;
		padding: 0.2rem 0.45rem;
		border-radius: 8px;
		background: rgba(15, 95, 176, 0.08);
		color: var(--vgv-azul-oscuro);
		font-weight: 700;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		font-size: 0.88rem;
		font-weight: 700;
	}

	.status-pill.available {
		background: rgba(76, 175, 80, 0.12);
		color: var(--vgv-verde-oscuro);
	}

	.status-pill.out {
		background: rgba(216, 64, 64, 0.12);
		color: var(--vgv-danger);
	}

	.status-pill.offer {
		background: rgba(255, 167, 38, 0.2);
		color: #9a4a00;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.btn-action {
		padding: 0.55rem 0.8rem;
		border: none;
		border-radius: 999px;
		background: var(--vgv-azul);
		color: var(--vgv-blanco);
		font-weight: 700;
		cursor: pointer;
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease,
			opacity 0.15s ease;
	}

	.btn-action.secondary {
		background: var(--vgv-verde);
	}

	.btn-action:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: var(--vgv-shadow-md);
	}

	.btn-action:disabled {
		opacity: 0.6;
		cursor: wait;
	}
</style>
