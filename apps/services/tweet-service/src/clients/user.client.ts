// Cliente HTTP mínimo hacia user-service para resolver @handle -> userId.
// Es la única dependencia síncrona de tweet-service; se usa solo para
// notificaciones de mención y es best-effort (un fallo no aborta el tweet).
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:3001";

/** Resuelve un handle (sin la @) a su userId. Devuelve null si no existe o falla. */
export const resolveHandleToUserId = async (handle: string): Promise<string | null> => {
    try {
        const res = await fetch(`${USER_SERVICE_URL}/v1/users/${encodeURIComponent(handle)}`);
        if (!res.ok) return null;
        const body = (await res.json()) as { userId?: string; user?: { userId?: string } };
        return body.userId ?? body.user?.userId ?? null;
    } catch (err) {
        console.error(`[user.client] Failed to resolve handle @${handle}:`, (err as Error).message);
        return null;
    }
};
