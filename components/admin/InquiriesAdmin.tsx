"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser, AuthPanel, signOut } from "@/components/dogs/auth";

type InquiryRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  message: string | null;
  created_at: string;
  notified_at: string | null;
};

// Read-only inbox for /advertise inquiries. RLS restricts ad_inquiries reads
// to app_admins (see supabase/schema.sql) — same gate as the other admin
// pages. notified_at is stamped by the notify-ad-inquiry Edge Function when
// the email nudge goes out, so "not emailed" rows are leads nobody was told
// about (e.g. RESEND_API_KEY unset).
export default function InquiriesAdmin() {
  const { user, loading, configured } = useSupabaseUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<InquiryRow[]>([]);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data: adminRow } = await supabase
      .from("app_admins")
      .select("email")
      .eq("email", user.email ?? "")
      .maybeSingle();
    const admin = Boolean(adminRow);
    setIsAdmin(admin);
    if (!admin) return;

    const { data } = await supabase
      .from("ad_inquiries")
      .select("id, business_name, contact_name, email, message, created_at, notified_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as InquiryRow[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in with an admin account to read ad inquiries." />;
  if (isAdmin === false)
    return (
      <div className="border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold">
          You&apos;re signed in as {user.email}, but that address isn&apos;t an
          admin. Add it to the <code>app_admins</code> table to read inquiries.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-3 text-xs font-bold uppercase tracking-wide text-black/50 hover:underline"
        >
          Sign out
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-bold text-black/60">
        {rows.length} inquir{rows.length === 1 ? "y" : "ies"}
      </p>

      {rows.length === 0 && (
        <p className="border-[3px] border-black bg-white p-4 text-sm font-bold text-black/50 shadow-hard">
          Nothing yet — inquiries from /advertise show up here, newest first.
        </p>
      )}

      {rows.map((row) => (
        <div key={row.id} className="border-[3px] border-black bg-white p-4 shadow-hard">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-xl font-extrabold">{row.business_name}</p>
              <p className="text-xs font-bold text-black/50">
                {row.contact_name} ·{" "}
                <a href={`mailto:${row.email}`} className="underline">
                  {row.email}
                </a>
              </p>
            </div>
            <span
              className={`shrink-0 border border-black px-1.5 py-0.5 text-[10px] font-black uppercase ${
                row.notified_at
                  ? "bg-[var(--turq)] text-[var(--sand)]"
                  : "bg-[var(--gold)]"
              }`}
              title={
                row.notified_at
                  ? `Email sent ${new Date(row.notified_at).toLocaleString()}`
                  : "No notification email was sent for this inquiry."
              }
            >
              {row.notified_at ? "emailed" : "not emailed"}
            </span>
          </div>
          {row.message && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-black/70">{row.message}</p>
          )}
          <p className="mt-2 text-xs text-black/40">
            Received {new Date(row.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
