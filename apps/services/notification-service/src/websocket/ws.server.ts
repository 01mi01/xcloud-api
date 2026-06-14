import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyJwt } from "@xcloud/shared";
import { registerConnection, removeConnection } from "./ws.publisher";

// Attaches a WebSocket server to the existing HTTP server.
//
// Clients connect to ws://<host>/ws?token=<JWT>. The JWT is passed as a query
// param because browsers cannot set custom headers on a WebSocket handshake.
// On a valid token we register the connection under the user's id so that
// `pushToUser` (called when a notification is created) can deliver in real time.
export const attachWebSocketServer = (server: Server): void => {
    // noServer: we drive the upgrade ourselves (below) so we can authenticate
    // the JWT before completing the handshake. Letting WebSocketServer attach
    // its own upgrade listener too would double-handle the upgrade.
    const wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws: WebSocket, userId: string) => {
        const conn = { send: (data: string) => ws.send(data) };
        registerConnection(userId, conn);

        ws.on("close", () => removeConnection(userId, conn));
        ws.on("error", () => removeConnection(userId, conn));

        // Greeting so the client knows the channel is live.
        ws.send(JSON.stringify({ type: "connected" }));
    });

    server.on("upgrade", (req, socket, head) => {
        // Only handle our path; let other upgrade handlers (if any) pass through.
        const { url } = req;
        if (!url || !url.startsWith("/ws")) return;

        try {
            const token = new URL(url, "http://localhost").searchParams.get("token");
            if (!token) throw new Error("missing token");
            const payload = verifyJwt(token);
            const userId = (payload.sub as string) || (payload as { userId?: string }).userId;
            if (!userId) throw new Error("token has no subject");

            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit("connection", ws, userId);
            });
        } catch {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
        }
    });

    console.log("[ws] WebSocket server attached at /ws");
};
