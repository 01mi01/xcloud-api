// Bridges Express and the Smithy server SDK (SSDK).
//
// A generated SSDK handler speaks the abstract @smithy/protocol-http
// HttpRequest/HttpResponse, and owns request deserialization, input
// validation and response/error serialization for ONE operation. This adapter
// converts the Express request, invokes the handler with a context carrying
// the JWT payload set by `verifyToken`, and writes the result back.
//
// express.json() has already consumed the body stream, so the body is
// re-serialized from `req.body` (JSON-equivalent, which is all the
// deserializer needs).
import type { Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import { HttpRequest, HttpResponse } from "@smithy/protocol-http";

export type AuthUser = JwtPayload & { sub: string; username?: string; "cognito:username"?: string };

/** Context passed as the second argument to every SSDK operation implementation. */
export interface HandlerContext {
    user?: AuthUser;
}

interface SmithyHandler {
    handle(request: HttpRequest, context: HandlerContext): Promise<HttpResponse>;
}

function toHttpRequest(req: Request): HttpRequest {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        headers[key] = Array.isArray(value) ? value.join(",") : value;
    }

    const query: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(req.query)) {
        if (value === undefined) continue;
        query[key] = Array.isArray(value) ? value.map(String) : String(value);
    }

    const contentLength = Number(req.headers["content-length"] ?? 0);
    return new HttpRequest({
        method: req.method,
        path: req.originalUrl.split("?")[0],
        headers,
        query,
        body: contentLength > 0 ? Buffer.from(JSON.stringify(req.body ?? {})) : undefined,
    });
}

function writeResponse(res: Response, httpResponse: HttpResponse): void {
    res.status(httpResponse.statusCode);
    for (const [key, value] of Object.entries(httpResponse.headers ?? {})) {
        if (key.toLowerCase() === "content-length") continue; // Express recalculates
        res.setHeader(key, value);
    }
    if (httpResponse.body) {
        res.send(httpResponse.body);
    } else {
        res.end();
    }
}

/** Wrap a generated SSDK operation handler as an Express request handler. */
export function smithyToExpress(handler: SmithyHandler) {
    return async (req: Request, res: Response): Promise<void> => {
        const context: HandlerContext = { user: (req as Request & { user?: AuthUser }).user };
        const httpResponse = await handler.handle(toHttpRequest(req), context);
        writeResponse(res, httpResponse);
    };
}
