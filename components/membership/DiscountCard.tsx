"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser, AuthPanel } from "@/components/dogs/auth";

type Member = {
  status: string;
  card_code: string | null;
  member_name: string | null;
};

// Mobile-first digital membership card — the "show to cashier" screen. Renders
// only for active members; encodes the card code as a QR so a cashier can scan
// or eyeball it. No native app needed.
export default function DiscountCard() {
  const { user, loading, configured } = useSupabaseUser();
  const [member, setMember] = useState<Member | null>(null);
  const [checked, setChecked] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !user) return;
    let cancelled = false;
    let tries = 0;

    // Poll briefly: the Stripe webhook that flips status to "active" may land a
    // beat after the post-checkout redirect. Stop once active or after a few
    // tries so a genuine non-member settles on the "join" state quickly.
    const run = async () => {
      const { data } = await supabase!
        .from("members")
        .select("status, card_code, member_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const row = (data as Member | null) ?? null;
      setMember(row);
      setChecked(true);
      if (row?.status !== "active" && tries < 4) {
        tries += 1;
        setTimeout(run, 2000);
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (member?.status === "active" && member.card_code) {
      QRCode.toDataURL(member.card_code, { margin: 1, width: 240 })
        .then(setQr)
        .catch(() => setQr(null));
    }
  }, [member]);

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in to view your membership card." />;

  if (checked && member?.status !== "active") {
    return (
      <div className="border-[3px] border-black bg-white p-6 text-center shadow-hard">
        <p className="text-4xl">🎫</p>
        <p className="mt-2 font-bold">You&apos;re not a member yet.</p>
        <Link
          href="/membership"
          className="mt-4 inline-block border-[3px] border-black bg-[var(--turq)] px-5 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard"
        >
          Join the club →
        </Link>
      </div>
    );
  }

  if (!member) return <p className="text-sm font-bold text-black/50">Loading card…</p>;

  return (
    <div className="mx-auto max-w-sm overflow-hidden border-[3px] border-black bg-gradient-to-br from-[var(--gold)] to-[var(--amber)] shadow-hard-lg">
      <div className="flex items-center justify-between border-b-[3px] border-black bg-[var(--navy)] px-4 py-3">
        <span className="font-display text-lg font-extrabold text-[var(--sand)]">
          🐾 Dogedin Club
        </span>
        <span className="border-2 border-black bg-[var(--turq)] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--sand)]">
          Member
        </span>
      </div>

      <div className="flex flex-col items-center gap-3 p-6">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="Membership QR code"
            width={200}
            height={200}
            className="border-[3px] border-black bg-white"
          />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center border-[3px] border-black bg-white text-xs text-black/40">
            Generating…
          </div>
        )}

        <p className="font-display text-xl font-extrabold text-[var(--ink)]">
          {member.member_name || user.email}
        </p>
        <p className="select-all border-2 border-black bg-white px-4 py-1 font-mono text-lg font-black tracking-widest">
          {member.card_code}
        </p>
        <p className="text-center text-xs font-bold text-[var(--ink)]/70">
          Show this screen at participating Dunedin businesses for member perks.
        </p>
      </div>
    </div>
  );
}
