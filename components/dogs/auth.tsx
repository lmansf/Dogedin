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

// Email + password sign-in / sign-up panel. On success, onAuthStateChange in
// useSupabaseUser flips the surrounding page to its signed-in view. If the
// project has email confirmation enabled, sign-up returns no session and we
// prompt the user to check their inbox.
export function AuthPanel({ intro }: { intro?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!supabase) {
    return (
      <p className="border-[3px] border-black bg-[var(--gold)]/30 px-4 py-3 text-sm font-bold">
        Sign-in isn&apos;t configured yet — set the Supabase env vars and run{" "}
        <code className="border border-black bg-white px-1">supabase/dogs.sql</code>.
      </p>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const client = supabase;
    if (!client) return;
    startTransition(async () => {
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

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-[3px] border-black bg-white p-5 shadow-hard"
    >
      <h2 className="font-display text-xl font-extrabold">
        {mode === "signup" ? "Create an account" : "Sign in"}
      </h2>
      {intro && <p className="text-sm text-black/60">{intro}</p>}

      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
      />
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

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}
      {message && <p className="text-sm font-bold text-[var(--green)]">{message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending ? "…" : mode === "signup" ? "Sign up" : "Sign in"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "signup" ? "signin" : "signup"));
          setError(null);
          setMessage(null);
        }}
        className="text-xs font-bold uppercase tracking-wide text-black/60 hover:underline"
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "Need an account? Sign up"}
      </button>
    </form>
  );
}
