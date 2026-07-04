"use client";

import { useEffect, useState, useTransition } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Tracks the current Supabase auth user in the browser. Returns
// configured=false when Supabase env vars are absent so pages can show a
// "not connected yet" state instead of crashing.
export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading, configured: supabase !== null };
}

export async function signOut() {
  await supabase?.auth.signOut();
}

// Admin-role check, shared by every admin surface (ad console, business/photo
// queues, etc.). Returns isAdmin: null while unknown (not signed in or still
// checking), true/false once the current user's app_admins membership is known.
// The real enforcement is RLS — this only decides what UI to show.
export function useIsAdmin() {
  const { user, loading, configured } = useSupabaseUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase || !user) {
      setIsAdmin(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("app_admins")
      .select("email")
      .eq("email", user.email ?? "")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { user, loading, configured, isAdmin };
}

// Email + password sign-in / sign-up panel with a "forgot password" path. On
// sign-in/up success, onAuthStateChange in useSupabaseUser flips the
// surrounding page to its signed-in view. If the project has email
// confirmation enabled, sign-up returns no session and we prompt the user to
// check their inbox. In "reset" mode we email a recovery link that lands on
// /reset-password (see ResetPasswordFlow) where the new password is chosen.
export function AuthPanel({ intro }: { intro?: string }) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!supabase) {
    return (
      <p className="border-[3px] border-black bg-[var(--gold)]/30 px-4 py-3 text-sm font-bold">
        Sign-in isn&apos;t configured yet — set the Supabase env vars and run{" "}
        <code className="border border-black bg-white px-1">supabase/schema.sql</code>.
      </p>
    );
  }

  const switchMode = (next: "signin" | "signup" | "reset") => {
    setMode(next);
    setError(null);
    setMessage(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const client = supabase;
    if (!client) return;
    startTransition(async () => {
      if (mode === "reset") {
        // Supabase always returns success here (even for unknown emails) so we
        // never reveal whether an address has an account. The link returns to
        // /reset-password to finish setting the new password.
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) return setError(error.message);
        return setMessage(
          "If that email has an account, we've sent a reset link. Check your inbox (and spam)."
        );
      }
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) return setError(error.message);
        if (!data.session)
          return setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return setError(error.message);
      }
    });
  };

  const title =
    mode === "signup"
      ? "Create an account"
      : mode === "reset"
        ? "Reset your password"
        : "Sign in";

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-[3px] border-black bg-white p-5 shadow-hard"
    >
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      {intro && mode !== "reset" && <p className="text-sm text-black/60">{intro}</p>}
      {mode === "reset" && (
        <p className="text-sm text-black/60">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      )}

      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
      />
      {mode !== "reset" && (
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 characters)"
          className="border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
        />
      )}

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}
      {message && <p className="text-sm font-bold text-[var(--green)]">{message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending
          ? "…"
          : mode === "signup"
            ? "Sign up"
            : mode === "reset"
              ? "Send reset link"
              : "Sign in"}
      </button>

      {mode === "signin" && (
        <button
          type="button"
          onClick={() => switchMode("reset")}
          className="self-start text-xs font-bold uppercase tracking-wide text-black/60 hover:underline"
        >
          Forgot your password?
        </button>
      )}

      <button
        type="button"
        onClick={() =>
          switchMode(
            mode === "reset" ? "signin" : mode === "signup" ? "signin" : "signup"
          )
        }
        className="text-xs font-bold uppercase tracking-wide text-black/60 hover:underline"
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : mode === "reset"
            ? "Back to sign in"
            : "Need an account? Sign up"}
      </button>
    </form>
  );
}
