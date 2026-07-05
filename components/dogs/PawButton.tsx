"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseUser } from "./auth";
import { hasPawedDog, toggleDogPaw } from "@/lib/dogPaws";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  sm: "gap-1 px-2 py-1 text-xs",
  md: "gap-1.5 px-3 py-1.5 text-sm",
  lg: "gap-2 px-4 py-2 text-base",
};

// One reusable "paw" (like) control for a dog's PROFILE — used on the carousel,
// the top-of-the-pack rail, and the profile hero. One paw per signed-in user
// (dog_paws / lib/dogPaws), so the tally everyone sees stays real: a paw always
// maps to an account, and nobody can inflate it. Everyone sees the live count;
// signed-out visitors get a link to sign in (defaults to the dog's profile,
// where the sign-in panel lives — pass signInHref="#join" to point at an
// on-page anchor instead). Optimistic toggle with revert on error.
export default function PawButton({
  dogId,
  slug,
  dogName,
  initialCount,
  initialPawed,
  size = "md",
  signInHref,
  className = "",
}: {
  dogId: string;
  slug: string;
  dogName: string;
  initialCount: number;
  initialPawed?: boolean;
  size?: Size;
  signInHref?: string;
  className?: string;
}) {
  const { user, loading, configured } = useSupabaseUser();
  const [count, setCount] = useState(initialCount);
  const [pawed, setPawed] = useState(initialPawed ?? false);
  const [busy, setBusy] = useState(false);

  // Track the server's tally if it changes under us (ISR refresh, prop change).
  useEffect(() => setCount(initialCount), [initialCount]);

  // Learn whether THIS viewer has already pawed — only when signed in and the
  // parent didn't already tell us. RLS scopes the read to the caller's rows,
  // so a signed-out visitor never triggers it.
  useEffect(() => {
    if (initialPawed !== undefined) return;
    if (!user) {
      setPawed(false);
      return;
    }
    let alive = true;
    hasPawedDog(dogId).then((p) => {
      if (alive) setPawed(p);
    });
    return () => {
      alive = false;
    };
  }, [dogId, user, initialPawed]);

  const base = `inline-flex items-center border-[3px] border-black font-black uppercase tracking-wide shadow-hard transition-transform ${SIZE[size]} ${className}`;

  // Not wired, or auth still resolving: show the tally, read-only.
  if (!configured || loading) {
    return (
      <span className={`${base} bg-white text-black/60`} aria-label={`${count} paws`}>
        🐾 {count}
      </span>
    );
  }

  // Signed out: link to sign in (the paw needs an account). Still shows the
  // live tally. Hash targets use a plain anchor (same-page scroll); route
  // targets use Link so internal navigation stays client-side.
  if (!user) {
    const href = signInHref ?? `/dog/${slug}`;
    const label = `Sign in to give ${dogName} a paw`;
    const cls = `${base} bg-white text-black/60 hover:-translate-y-0.5`;
    return href.startsWith("#") ? (
      <a href={href} className={cls} title={label} aria-label={label}>
        🐾 {count}
      </a>
    ) : (
      <Link href={href} className={cls} title={label} aria-label={label}>
        🐾 {count}
      </Link>
    );
  }

  const toggle = async () => {
    if (busy) return;
    const was = pawed;
    setBusy(true);
    setPawed(!was);
    setCount((c) => Math.max(0, c + (was ? -1 : 1)));
    const { error } = await toggleDogPaw(dogId, was);
    setBusy(false);
    if (error) {
      setPawed(was);
      setCount((c) => Math.max(0, c + (was ? 1 : -1)));
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={pawed}
      aria-label={pawed ? `Remove your paw from ${dogName}` : `Give ${dogName} a paw`}
      className={`${base} enabled:hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-60 ${
        pawed ? "bg-[var(--coral)] text-white" : "bg-white text-black/70"
      }`}
    >
      🐾 {count}
    </button>
  );
}
