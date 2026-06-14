import { WebSocketServer } from "ws";
import type { Server } from "http";
import { verifyJwt } from "@xcloud/shared";
import { registerConnection, removeConnection } from "./ws.publisher";

/**
 * Attaches a WebSocket server to the notification HTTP server.
 *
 * The browser connects to `/v1/notifications/ws?token=<jwt>` (same-origin via
 * the Vite proxy in dev). The JWT is verified at the handshake; its `sub` claim
 * is the userId whose notifications this socket receives. `pushToUser` (in
 * ws.publisher) then delivers events to all of that user's live sockets.
 */
export const attachWebSocketServer = (server: Server): void => {
    const wss = new WebSocketServer({ server, path: "/v1/notifications/ws" });

    wss.on("connection", (ws, request) => {
        try {
            const url = new URL(request.url ?? "", "http://localhost");
            const token = url.searchParams.get("token");
            if (!token) {
                ws.close(1008, "missing token");
                return;
            }
            const payload = verifyJwt(token);
            const userId = String(payload.sub);

            registerConnection(userId, ws);
            ws.send(JSON.stringify({ type: "connected" }));

            ws.on("close", () => removeConnection(userId, ws));
            ws.on("error", () => removeConnection(userId, ws));
        } catch {
            ws.close(1008, "invalid token");
        }
    });

    console.log("[ws] WebSocket server attached at /v1/notifications/ws");
};
