export function importRecoveryState(pending, report) {
	const matching = Boolean(pending && report && pending.batchId === report.batchId);
	const available = matching && !report.processing;
	const retryRows = available
		? report.rows
				.filter((row) => ['pending', 'failed', 'conflict'].includes(row.status))
				.map((row) => row.position)
		: [];
	return {
		retryRows,
		canRetry: retryRows.length > 0,
		canArchive: available && report.unknown === 0
	};
}

export function canResubmitRejectedImport(pending, report) {
	return Boolean(pending?.submission === 'rejected' && !report);
}

export async function sendImportBatch({
	pending,
	retryRows,
	token,
	url,
	persist,
	request = fetch
}) {
	const noPreviousWrite = ['notSent', 'rejected'].includes(pending.submission);
	let next = { ...pending, submission: 'unknown' };
	// Persist ambiguity before dispatch: a lost response must not retain permission to resend.
	persist(next);
	const response = await request(url('/admin/products/bulk'), {
		method: 'POST',
		headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({
			batchId: pending.batchId,
			products: pending.products,
			...(retryRows === undefined ? {} : { retryRows })
		})
	});
	const data = await response.json();
	if (response.ok && data.batchId === pending.batchId && Array.isArray(data.rows)) {
		next = { ...next, submission: data.complete ? 'confirmed' : 'started' };
	} else if (
		noPreviousWrite &&
		[401, 403, 429].includes(response.status) &&
		data.importNotStarted === true
	) {
		next = { ...next, submission: 'rejected' };
	}
	persist(next);
	return { response, data };
}
