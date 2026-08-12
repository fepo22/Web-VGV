let socketServer = null;

export function setSocketServer(io) {
	socketServer = io;
}

export function getSocketServer() {
	return socketServer;
}

export function emitProductEvent(eventName, payload) {
	if (!socketServer) return;
	socketServer.emit(eventName, payload);
}