"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser, AuthPanel, signOut } from "@/components/dogs/auth";

type Row = {
  id: string;
  business_name: string;
  tagline: string | null;
  image_url: string;
  link_url: string;
  weight: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
};

// slot → {impressions, clicks} aggregated over the last 30 days, per ad.
type SlotStats = Record<string, Record<string, { imp: number; clicks: number }>>;

// Admin CRUD for advertisers. Access is enforced by RLS (only emails in the
// app_admins table can read all rows or write); this component also checks
// membership so non-admins see a clear "not authorised" message instead of an
// empty screen. No code changes needed to add/remove an advertiser.
//
// Reporting: lifetime totals live on the row; the 30-day per-slot breakdown
// (from ad_stats_daily) is what you show an advertiser at renewal — which
// placement performed, at what CTR.
export default function AdsAdmin() {
  const { user, loading, configured } = useSupabaseUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<SlotStats>({});

  const [form, setForm] = useState({
    business_name: "",
    tagline: "",
    image_url: "",
    link_url: "",
    weight: 1,
    starts_at: "",
    ends_at: "",
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    // Admin check: can this user see their own app_admins row?
    const { data: adminRow } = await supabase
      .from("app_admins")
      .select("email")
      .eq("email", user.email ?? "")
      .maybeSingle();
    const admin = Boolean(adminRow);
    setIsAdmin(admin);
    if (!admin) return;

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const [adsRes, statsRes] = await Promise.all([
      supabase
        .from("advertisers")
        .select(
          "id, business_name, tagline, image_url, link_url, weight, active, starts_at, ends_at, impressions, clicks"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("ad_stats_daily")
        .select("ad_id, slot, impressions, clicks")
        .gte("day", since),
    ]);
    setRows((adsRes.data as Row[]) ?? []);

    const agg: SlotStats = {};
    for (const s of statsRes.data ?? []) {
      const perAd = (agg[s.ad_id] ??= {});
      const cell = (perAd[s.slot] ??= { imp: 0, clicks: 0 });
      cell.imp += s.impressions ?? 0;
      cell.clicks += s.clicks ?? 0;
    }
    setStats(agg);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supabase) return;
    if (!form.business_name.trim() || !form.image_url.trim() || !form.link_url.trim())
      return setError("Business name, image URL and link URL are required.");
    const { error } = await supabase.from("advertisers").insert({
      business_name: form.business_name.trim(),
      tagline: form.tagline.trim() || null,
      image_url: form.image_url.trim(),
      link_url: form.link_url.trim(),
      weight: Number(form.weight) || 1,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    });
    if (error) return setError(error.message);
    setForm({
      business_name: "",
      tagline: "",
      image_url: "",
      link_url: "",
      weight: 1,
      starts_at: "",
      ends_at: "",
    });
    load();
  };

  const patch = async (id: string, changes: Partial<Row>) => {
    if (!supabase) return;
    await supabase.from("advertisers").update(changes).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!supabase) return;
    if (!confirm("Delete this advertiser?")) return;
    await supabase.from("advertisers").delete().eq("id", id);
    load();
  };

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in with an admin account to manage advertisers." />;
  if (isAdmin === false)
    return (
      <div className="border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold">
          You&apos;re signed in as {user.email}, but that address isn&apos;t an
          admin. Add it to the <code>app_admins</code> table to manage ads.
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
    <div className="flex flex-col gap-6">
      <form
        onSubmit={add}
        className="flex flex-col gap-3 border-[3px] border-black bg-white p-5 shadow-hard"
      >
        <h2 className="font-display text-xl font-extrabold">Add advertiser</h2>
        <input
          className={input}
          placeholder="Business name"
          value={form.business_name}
          onChange={(e) => setForm({ ...form, business_name: e.target.value })}
        />
        <input
          className={input}
          placeholder="Tagline (one line, shown on the card format)"
          maxLength={120}
          value={form.tagline}
          onChange={(e) => setForm({ ...form, tagline: e.target.value })}
        />
        <input
          className={input}
          placeholder="Image URL (/assets/ads/foo.png or https://…)"
          value={form.image_url}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
        />
        <input
          className={input}
          placeholder="Link URL (https://…)"
          value={form.link_url}
          onChange={(e) => setForm({ ...form, link_url: e.target.value })}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold">
            Weight
            <input
              type="number"
              min={0}
              max={100}
              className={`${input} w-24`}
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            Runs
            <input
              type="date"
              className={input}
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
            →
            <input
              type="date"
              className={input}
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </label>
        </div>
        <p className="text-xs font-bold text-black/40">
          Leave dates blank for an evergreen campaign. Expired campaigns drop out
          of rotation automatically.
        </p>
        {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}
        <button
          type="submit"
          className="w-fit border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard"
        >
          Add
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <p className="text-sm font-bold text-black/50">No advertisers yet.</p>
        )}
        {rows.map((r) => {
          const perSlot = stats[r.id] ?? {};
          const slots = Object.keys(perSlot).sort();
          return (
            <div
              key={r.id}
              className="flex flex-col gap-2 border-[3px] border-black bg-white p-3 shadow-hard"
            >
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image_url}
                  alt={r.business_name}
                  className="h-12 w-24 border-2 border-black object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-extrabold">{r.business_name}</p>
                  <p className="truncate text-xs text-black/50">{r.link_url}</p>
                  <p className="text-xs font-bold text-black/60">
                    Lifetime: 👁 {r.impressions} · 👆 {r.clicks}
                    {(r.starts_at || r.ends_at) && (
                      <>
                        {" "}
                        · 🗓 {r.starts_at ?? "…"} → {r.ends_at ?? "…"}
                      </>
                    )}
                  </p>
                </div>
                <label className="flex items-center gap-1 text-xs font-bold">
                  Wt
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={r.weight}
                    onBlur={(e) => patch(r.id, { weight: Number(e.target.value) })}
                    className="w-16 border-2 border-black px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => patch(r.id, { active: e.target.checked })}
                    className="h-4 w-4 accent-[var(--turq)]"
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="text-xs font-bold uppercase tracking-wide text-[var(--red)] hover:underline"
                >
                  Delete
                </button>
              </div>

              {/* 30-day per-slot breakdown — the renewal conversation. */}
              {slots.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t-2 border-dashed border-black/15 pt-2">
                  {slots.map((slot) => {
                    const s = perSlot[slot];
                    const ctr = s.imp > 0 ? ((s.clicks / s.imp) * 100).toFixed(1) : "0.0";
                    return (
                      <span
                        key={slot}
                        className="border-2 border-black bg-[var(--sand)] px-2 py-1 text-[11px] font-bold"
                      >
                        <span className="font-black uppercase">{slot}</span> · 30d: 👁{" "}
                        {s.imp} · 👆 {s.clicks} · {ctr}% CTR
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const input =
  "border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";
