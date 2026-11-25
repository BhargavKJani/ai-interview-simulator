"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Account } from "@/lib/billing/handlers";
import { supabaseBrowser } from "@/lib/supabase-browser";

export interface AccountState {
  /** Server status has loaded. */
  ready: boolean;
  /** Payments are configured on the server (otherwise the app runs in free demo mode). */
  billing: boolean;
  /** Claude is available to users with an AI session. */
  ai: boolean;
  email: string | null;
  account: Account | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Fresh access token for API calls, or "" when signed out. */
  token: () => Promise<string>;
}

const Ctx = createContext<AccountState | null>(null);

export function useAccount(): AccountState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAccount must be used inside <AccountProvider>");
  return v;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [billing, setBilling] = useState(false);
  const [ai, setAi] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const token = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return "";
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const refresh = useCallback(async () => {
    const t = await token();
    if (!t) {
      setEmail(null);
      setAccount(null);
      return;
    }
    try {
      const res = await fetch("/api/billing/me", { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { email: string | null; account: Account };
      setEmail(body.email);
      setAccount(body.account);
    } catch {
      setAccount(null);
    }
  }, [token]);

  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: { ai?: boolean; billing?: boolean }) => {
        if (!alive) return;
        setBilling(!!s.billing && !!supabaseBrowser());
        setAi(!!s.ai);
      })
      .catch((e) => console.error("[account] status failed:", e))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!billing || !sb) return;
    // Fires INITIAL_SESSION straight away, then on every sign-in, sign-out and token refresh.
    const { data } = sb.auth.onAuthStateChange(() => void refresh());
    return () => data.subscription.unsubscribe();
  }, [billing, refresh]);

  const signIn = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) return;
    await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
  }, []);

  const signOut = useCallback(async () => {
    await supabaseBrowser()?.auth.signOut();
    setEmail(null);
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({ ready, billing, ai, email, account, signIn, signOut, refresh, token }),
    [ready, billing, ai, email, account, signIn, signOut, refresh, token],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
