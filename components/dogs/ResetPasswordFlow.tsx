"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Landing surface for the password-recovery email link. Supabase's link
// redirects here with a one-time recovery token in the URL hash; supabase-js
// (detectSessionInUrl, on by default) consumes it and establishes a temporary
// session, firing a PASSWORD_RECOVERY auth event. We then let the owner choose
// a new password via updateUser(). Because that event can fire before this
// component mounts, we also check getSession() so we don't miss it.
type Phase = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Inline "send me a new link" so an expired/used link is one click to fix,
  // instead of navigating away to find the forgot-password form again.
  const [resendEmail, setResendEmail] = useState("");
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resending, startResend] = useTransition();

  const sendNewLink = (e: React.FormEvent) => {
    e.preventDefault();
    setResendMsg(null);
    if (!supabase) return;
    const client = supabase;
    startResend(async () => {
      const { error } = await client.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResendMsg(
        error
          ? error.message
          : "If that email has an account, a fresh link is on its way. Open it soon — the link expires and can only be used once."
      );
    });
  };

  useEffect(() => {
    if (!supabase) {
      setPhase("invalid");
      return;
    }
    const client = supabase;

    // An expired or already-used link comes back with error params in the hash
    // (e.g. #error=access_denied&error_code=otp_expired). Surface that instead
    // of a blank form the user can't submit.
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const params = new URLSearchParams(hash);
      if (params.get("error") || params.get("error_description")) {
        setError(
          params.get("error_description")?.replace(/\+/g, " ") ||
            "This reset link is invalid or has expired."
        );
        setPhase("invalid");
        return;
      }
    }

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setPhase("ready");
    });

    // Catch a session already established before we subscribed. If there's no
    // recovery session at all, the link is missing or spent.
    client.auth.getSession().then(({ data }) => {
      setPhase((p) => {
        if (p !== "checking") return p; // listener already resolved it
        return data.session ? "ready" : "invalid";
      });
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const client = supabase;
    if (!client) return;
    if (password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Those passwords don't match.");

    startTransition(async () => {
      const { error } = await client.auth.updateUser({ password });
      if (error) return setError(error.message);
      setPhase("done");
      // Send them on to their dogs; the recovery session is now a normal one.
      setTimeout(() => router.push("/account"), 1800);
    });
  };

  if (phase === "checking") {
    return <p className="text-sm font-bold text-black/50">Checking your link…</p>;
  }

  if (phase === "invalid") {
    return (
      <form
        onSubmit={sendNewLink}
        className="flex flex-col gap-3 border-[3px] border-black bg-white p-5 shadow-hard"
      >
        <h2 className="font-display text-xl font-extrabold">Reset link problem</h2>
        <p className="text-sm text-black/70">
          {error ||
            "This reset link is invalid or has expired. Reset links can only be used once and time out for security."}
        </p>
        <p className="text-sm font-bold text-black/70">
          Enter your email and we&apos;ll send a fresh one:
        </p>
        <input
          type="email"
          required
          autoComplete="email"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          placeholder="Email"
          className="border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
        />
        {resendMsg && (
          <p className="text-sm font-bold text-[var(--green)]">{resendMsg}</p>
        )}
        <button
          type="submit"
          disabled={resending}
          className="w-fit border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
        >
          {resending ? "Sending…" : "Send a new link"}
        </button>
      </form>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col gap-3 border-[3px] border-black bg-white p-5 shadow-hard">
        <h2 className="font-display text-xl font-extrabold">Password updated 🐾</h2>
        <p className="text-sm text-black/70">
          You&apos;re signed in. Taking you to your dogs…
        </p>
        <Link href="/account" className="text-sm font-bold text-[var(--turq)] hover:underline">
          Go now
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-[3px] border-black bg-white p-5 shadow-hard"
    >
      <h2 className="font-display text-xl font-extrabold">Choose a new password</h2>
      <p className="text-sm text-black/60">
        Enter a new password for your account. You&apos;ll be signed in right after.
      </p>

      <input
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 6 characters)"
        className="border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
      />
      <input
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm new password"
        className="border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
      />

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
