"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser, AuthPanel } from "@/components/dogs/auth";
import { createCheckoutSession } from "@/app/membership/actions";

// Drives the membership call-to-action: sign-in gate → "become a member"
// (Stripe Checkout) → or, if already active, a link to the digital card.
export default function MembershipCta() {
  const { user, loading, configured } = useSupabaseUser();
  const [status, setStatus] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("members")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setStatus((data as { status?: string } | null)?.status ?? null);
        setChecked(true);
      });
  }, [user]);

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in or create an account to join the club." />;

  if (checked && status === "active") {
    return (
      <div className="border-[3px] border-black bg-[var(--green)] p-5 text-center shadow-hard">
        <p className="font-display text-xl font-extrabold text-[var(--sand)]">
          You&apos;re a member! 🎉
        </p>
        <Link
          href="/card"
          className="mt-3 inline-block border-[3px] border-black bg-[var(--gold)] px-5 py-2 text-sm font-black uppercase tracking-wide shadow-hard"
        >
          View your discount card →
        </Link>
      </div>
    );
  }

  const join = () => {
    setError(null);
    startTransition(async () => {
      const { data } = await supabase!.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setError("Please sign in again.");
      const res = await createCheckoutSession({ accessToken: token });
      if ("url" in res) window.location.href = res.url;
      else setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className="w-full border-[3px] border-black bg-[var(--turq)] px-5 py-3 text-base font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending ? "Redirecting to checkout…" : "Become a member"}
      </button>
      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}
      <p className="text-center text-xs font-bold text-black/40">
        Secure recurring billing via Stripe · cancel anytime
      </p>
    </div>
  );
}
