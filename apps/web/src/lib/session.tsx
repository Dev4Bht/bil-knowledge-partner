"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, login as apiLogin, logout as apiLogout, onUnauthorized } from "./api";
import type { User } from "./types";

type SessionState = { status: "loading" } | { status: "anonymous"; reason?: "signed_out" } | { status: "authenticated"; user: User };

type SessionApi = {
  state: SessionState;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children, initial }: { children: ReactNode; initial?: SessionState }) {
  const [state, setState] = useState<SessionState>(initial ?? { status: "loading" });

  useEffect(() => {
    if (initial) return;
    const controller = new AbortController();
    getMe(controller.signal)
      .then((user) => setState({ status: "authenticated", user }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setState({ status: "anonymous" });
      });
    return () => controller.abort();
  }, [initial]);

  useEffect(() => onUnauthorized(() => setState({ status: "anonymous" })), []);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await apiLogin(email, password);
    setState({ status: "authenticated", user });
    return user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setState({ status: "anonymous", reason: "signed_out" });
    }
  }, []);

  const value = useMemo<SessionApi>(
    () => ({ state, user: state.status === "authenticated" ? state.user : null, signIn, signOut }),
    [state, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
