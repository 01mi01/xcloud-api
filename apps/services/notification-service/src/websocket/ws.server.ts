import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { verifyJwt } from "@xcloud/shared";
import { registerConnection, removeConnection } from "./ws.publisher";

// ws connections we track liveness on (set on pong; cleared before each ping).
type AliveSocket = WebSocket & { isAlive?: boolean };

// Ping clients on this interval. Must be < the ALB idle timeout (it closes idle
// connections, default 60s) so the regular ping traffic keeps the tunnel —
// viewer↔CloudFront↔ALB↔service — open. Also reaps sockets that stopped ponging.
const HEARTBEAT_MS = 30_000;

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

    wss.on("connection", (ws: AliveSocket, request) => {
        ws.isAlive = true;
        ws.on("pong", () => { ws.isAlive = true; });
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

    // Heartbeat: ping everyone every HEARTBEAT_MS; terminate any socket that
    // didn't pong since the last round (dead/half-open connection).
    const heartbeat = setInterval(() => {
        for (const client of wss.clients as Set<AliveSocket>) {
            if (client.isAlive === false) { client.terminate(); continue; }
            client.isAlive = false;
            try { client.ping(); } catch { /* terminating anyway */ }
        }
    }, HEARTBEAT_MS);
    wss.on("close", () => clearInterval(heartbeat));

    console.log("[ws] WebSocket server attached at /v1/notifications/ws");
};
