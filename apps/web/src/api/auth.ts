import { apiFetch } from "./client";

export interface LoginResponse {
  token: string;
  idToken: string;
  expiresAt: string;
}

export interface RegisterResponse {
  userId: string;
  token: string;
}

export interface MeResponse {
  userId: string;
  email: string;
  role: string;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/v1/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function register(handle: string, email: string, password: string): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/v1/auth/register", {
    method: "POST",
    body: { handle, email, password },
    auth: false,
  });
}

export function me(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/v1/auth/me");
}

/**
 * Best-effort decode of the Cognito access token to extract the `username` claim
 * (which corresponds to the user's handle). Returns null if the token is malformed.
 */
export function decodeHandleFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { username?: string; "cognito:username"?: string };
    return claims.username ?? claims["cognito:username"] ?? null;
  } catch {
    return null;
  }
}
