export function importRejection(req) {
	return req.method === "POST" && req.originalUrl?.split("?")[0] === "/admin/products/bulk"
		? { importNotStarted: true } : {};
}
