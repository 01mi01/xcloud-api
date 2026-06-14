import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import * as authApi from "../api/auth";
import * as usersApi from "../api/users";
import { ApiError, clearToken, getToken, setToken } from "../api/client";
import type { AuthIdentity, User } from "../types";

export type AuthStatus = "loading" | "authed" | "anon";

interface AuthContextValue {
  status: AuthStatus;
  identity: AuthIdentity | null;
  profile: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (handle: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function hydrateFromToken(token: string): Promise<{ identity: AuthIdentity; profile: User | null }> {
  const me = await authApi.me();
  const handle = authApi.decodeHandleFromToken(token);
  const identity: AuthIdentity = { userId: me.userId, email: me.email, role: me.role, handle };

  let profile: User | null = null;
  if (handle) {
    try {
      profile = await usersApi.getUser(handle);
    } catch {
      // user-service may be unavailable or the profile may not exist yet.
      // Auth is still valid; downstream consumers handle a null profile.
      profile = null;
    }
  }
  return { identity, profile };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [profile, setProfile] = useState<User | null>(null);

  const applyToken = useCallback(async (token: string) => {
    setToken(token);
    try {
      const { identity, profile } = await hydrateFromToken(token);
      setIdentity(identity);
      setProfile(profile);
      setStatus("authed");
    } catch (err) {
      clearToken();
      setIdentity(null);
      setProfile(null);
      setStatus("anon");
      throw err;
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus("anon");
      return;
    }
    hydrateFromToken(token)
      .then(({ identity, profile }) => {
        setIdentity(identity);
        setProfile(profile);
        setStatus("authed");
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) clearToken();
        setIdentity(null);
        setProfile(null);
        setStatus("anon");
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token } = await authApi.login(email, password);
      await applyToken(token);
    },
    [applyToken],
  );

  const register = useCallback(
    async (handle: string, email: string, password: string) => {
      // §3.1 — register returns a JWT directly; no separate login needed.
      const { token } = await authApi.register(handle, email, password);
      await applyToken(token);
    },
    [applyToken],
  );

  const logout = useCallback(() => {
    clearToken();
    setIdentity(null);
    setProfile(null);
    setStatus("anon");
  }, []);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setStatus("anon");
      return;
    }
    const { identity, profile } = await hydrateFromToken(token);
    setIdentity(identity);
    setProfile(profile);
    setStatus("authed");
  }, []);

  return (
    <AuthContext.Provider value={{ status, identity, profile, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
