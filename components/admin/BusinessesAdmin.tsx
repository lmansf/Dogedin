"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser, AuthPanel, signOut } from "@/components/dogs/auth";
import { DAYS_OF_WEEK, type BusinessHours } from "@/lib/businesses";

type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  neighborhood: string | null;
  description: string | null;
  image: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: BusinessHours | null;
  owner_name: string | null;
  owner_email: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
};

// Review queue for self-service business submissions (/list-your-business).
// RLS restricts the base `businesses` table to app_admins; the public site
// reads the public_businesses view instead (see supabase/schema.sql).
export default function BusinessesAdmin() {
  const { user, loading, configured } = useSupabaseUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      .from("businesses")
      .select(
        "id, slug, name, category, neighborhood, description, image, address, phone, website, hours, owner_name, owner_email, status, created_at"
      )
      .order("created_at", { ascending: false });
    setRows((data as BusinessRow[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const review = async (row: BusinessRow, status: "approved" | "denied") => {
    if (!supabase) return;
    setBusy(row.id);
    setNotice(null);
    const { error } = await supabase.from("businesses").update({ status }).eq("id", row.id);
    setBusy(null);
    if (error) return setNotice(`Couldn't save: ${error.message}`);
    setNotice(status === "approved" ? "Approved — now live on Things to do." : "Denied — hidden from the site.");
    load();
  };

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in with an admin account to review business listings." />;
  if (isAdmin === false)
    return (
      <div className="border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold">
          You&apos;re signed in as {user.email}, but that address isn&apos;t an
          admin. Add it to the <code>app_admins</code> table to review listings.
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

  const pending = rows.filter((r) => r.status === "pending");
  const others = rows.filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-bold text-black/60">{pending.length} awaiting review</p>

      {notice && (
        <p className="border-2 border-black bg-[var(--gold)]/25 px-3 py-2 text-sm font-bold">{notice}</p>
      )}

      {pending.length === 0 && (
        <p className="border-[3px] border-black bg-white p-4 text-sm font-bold text-black/50 shadow-hard">
          Nothing waiting — new submissions from /list-your-business show up here.
        </p>
      )}

      {pending.map((row) => (
        <div key={row.id} className="border-[3px] border-black bg-white p-4 shadow-hard">
          <div className="flex flex-col gap-4 sm:flex-row">
            {row.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.image}
                alt={row.name}
                className="h-40 w-full shrink-0 border-2 border-black object-cover sm:h-32 sm:w-48"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-display text-xl font-extrabold">{row.name}</p>
              <p className="text-xs font-bold text-black/50">
                {row.category}
                {row.neighborhood && ` · ${row.neighborhood}`}
              </p>
              {row.description && <p className="text-sm text-black/70">{row.description}</p>}
              {row.address && <p className="text-xs font-semibold text-black/60">📍 {row.address}</p>}
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-black/60">
                {row.phone && <span>📞 {row.phone}</span>}
                {row.website && <span>🔗 {row.website}</span>}
              </div>
              {row.hours && <HoursSummary hours={row.hours} />}
              <p className="mt-1 text-xs font-bold text-black/40">
                Submitted by {row.owner_name ?? "unknown"} ·{" "}
                <a href={`mailto:${row.owner_email}`} className="underline">
                  {row.owner_email}
                </a>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => review(row, "approved")}
                  disabled={busy !== null}
                  className="border-[3px] border-black bg-[var(--green)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => review(row, "denied")}
                  disabled={busy !== null}
                  className="border-[3px] border-black bg-[var(--red)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {others.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-extrabold">History</h2>
          {others.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-3 border-2 border-black bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">
                  {row.name}{" "}
                  <span
                    className={`ml-1 border border-black px-1.5 py-0.5 text-[10px] font-black uppercase ${
                      row.status === "approved"
                        ? "bg-[var(--turq)] text-[var(--sand)]"
                        : "bg-[var(--coral)] text-white"
                    }`}
                  >
                    {row.status}
                  </span>
                </p>
                <p className="text-xs text-black/50">{row.category}</p>
              </div>
              {row.status === "denied" && (
                <button
                  type="button"
                  onClick={() => review(row, "approved")}
                  disabled={busy !== null}
                  className="border-2 border-black bg-[var(--gold)] px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  Approve instead
                </button>
              )}
              {row.status === "approved" && (
                <button
                  type="button"
                  onClick={() => review(row, "denied")}
                  disabled={busy !== null}
                  className="border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  Remove from site
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HoursSummary({ hours }: { hours: BusinessHours }) {
  return (
    <p className="text-xs text-black/50">
      {DAYS_OF_WEEK.map((day) => {
        const d = hours[day];
        const label = day.slice(0, 3).replace(/^\w/, (c) => c.toUpperCase());
        return `${label} ${d.closed ? "closed" : `${d.open}–${d.close}`}`;
      }).join(" · ")}
    </p>
  );
}
