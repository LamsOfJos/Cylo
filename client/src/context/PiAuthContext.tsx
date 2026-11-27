"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { API_BASE_URL } from "@/lib/apiConfig";

const SESSION_KEY = "agrocylo:pi-session";

export interface PiPioneer {
  uid: string;
  username: string;
}

interface PiSession {
  accessToken: string;
  refreshToken: string;
  walletAddress: string;
  user: PiPioneer;
}

interface PiAuthContextValue {
  pioneer: PiPioneer | null;
  loading: boolean;
  error: string | null;
  signIn(): Promise<void>;
  signOut(): void;
}

const PiAuthContext = createContext<PiAuthContextValue | null>(null);

function hasValidToken(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    detail?: string;
    message?: string;
    title?: string;
  };
  if (!response.ok) {
    throw new Error(
      body.detail ?? body.message ?? body.title ?? "Pi sign-in could not be verified",
    );
  }
  return body;
}

export function PiAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<PiSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.Pi?.init({ version: "2.0", sandbox: false });
  }, []);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as PiSession;
        if (!parsed.accessToken || !parsed.user || !parsed.refreshToken) {
          throw new Error("Invalid saved Pi session");
        }
        if (hasValidToken(parsed.accessToken)) {
          if (active) setSession(parsed);
          return;
        }
        const refreshed = await readResponse<{
          accessToken: string;
          refreshToken: string;
        }>(
          await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: parsed.refreshToken }),
          }),
        );
        const next = { ...parsed, ...refreshed };
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
        if (active) setSession(next);
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.Pi) {
        throw new Error("Open Agrocylo in Pi Browser to sign in with Pi.");
      }
      const auth = await window.Pi.authenticate(["username"], () => undefined);
      const verified = await readResponse<PiSession>(
        await fetch(`${API_BASE_URL}/auth/pi/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: auth.accessToken }),
        }),
      );
      const nextSession: PiSession = {
        ...verified,
        user: { uid: verified.user.uid, username: verified.user.username },
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pi sign-in failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    if (session?.refreshToken) {
      void fetch(`${API_BASE_URL}/auth/logout`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      }).catch(() => undefined);
    }
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setError(null);
  }, [session]);

  const value = useMemo<PiAuthContextValue>(
    () => ({
      pioneer: session?.user ?? null,
      loading,
      error,
      signIn,
      signOut,
    }),
    [session, loading, error, signIn, signOut],
  );

  return (
    <PiAuthContext.Provider value={value}>
      {children}
    </PiAuthContext.Provider>
  );
}

export function usePiAuth(): PiAuthContextValue {
  const context = useContext(PiAuthContext);
  if (!context) throw new Error("usePiAuth must be used within PiAuthProvider");
  return context;
}
