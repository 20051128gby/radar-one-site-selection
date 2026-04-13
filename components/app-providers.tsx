"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { clearSession, loadSession, saveSession } from "@/lib/storage";
import { getSupabasePublicClient } from "@/lib/supabase";
import { UserSession } from "@/lib/types";

type AuthContextValue = {
  session: UserSession | null;
  hydrated: boolean;
  signIn: (email: string) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedSession = loadSession();
    setSession(storedSession);

    const supabaseClient = getSupabasePublicClient();
    if (!supabaseClient) {
      setHydrated(true);
      return;
    }
    const client = supabaseClient;

    let active = true;

    async function syncServerSession(accessToken: string) {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken })
      });

      if (!response.ok || !active) {
        clearSession();
        setSession(null);
        return;
      }

      const payload = (await response.json()) as { session: UserSession };
      saveSession(payload.session);
      setSession(payload.session);
    }

    async function bootstrap() {
      const {
        data: { session: supabaseSession }
      } = await client.auth.getSession();

      if (!active) {
        return;
      }

      if (!supabaseSession?.access_token) {
        clearSession();
        setSession(null);
        setHydrated(true);
        return;
      }

      await syncServerSession(supabaseSession.access_token);
      if (active) {
        setHydrated(true);
      }
    }

    void bootstrap();

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!nextSession?.access_token) {
        await fetch("/api/auth/session", { method: "DELETE" });
        clearSession();
        setSession(null);
        setHydrated(true);
        return;
      }

      await syncServerSession(nextSession.access_token);
      if (active) {
        setHydrated(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    hydrated,
    signIn(email) {
      const trimmedEmail = email.trim().toLowerCase();
      const nextSession: UserSession = {
        email: trimmedEmail,
        displayName: trimmedEmail.split("@")[0] || "Founder",
        role: "operator",
        planId: "free"
      };
      saveSession(nextSession);
      setSession(nextSession);
    },
    signOut() {
      const supabase = getSupabasePublicClient();
      if (supabase) {
        void supabase.auth.signOut();
      }
      void fetch("/api/auth/session", { method: "DELETE" });
      clearSession();
      setSession(null);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AppProviders");
  }

  return context;
}
