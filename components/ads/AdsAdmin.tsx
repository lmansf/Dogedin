"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser, AuthPanel, signOut } from "@/components/dogs/auth";
import { AD_SPECS, type AdPlacement, type AdStatus } from "@/lib/ads";
import { createAdCheckoutSession } from "@/app/admin/ads/actions";

type Row = {
  id: string;
  business_name: string;
  tagline: string | null;
  image_url: string;
  mobile_image_url: string | null;
  link_url: string;
  weight: number;
  placement: AdPlacement;
  status: AdStatus;
  contact_email: string | null;
  active: boolean;
  paid_at: string | null;
  stripe_payment_ref: string | null;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
};

// Lifecycle order used to sort the console: things needing a decision first.
const STATUS_ORDER: Record<AdStatus, number> = {
  applied: 0,
  approved: 1,
  active: 2,
  disabled: 3,
};

const STATUS_STYLE: Record<AdStatus, string> = {
  applied: "bg-[var(--gold)]",
  approved: "bg-[var(--turq)] text-[var(--sand)]",
  active: "bg-[var(--green)] text-[var(--sand)]",
  disabled: "bg-zinc-200 text-black/60",
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
    placement: "banner" as AdPlacement,
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
          "id, business_name, tagline, image_url, mobile_image_url, link_url, weight, placement, status, contact_email, active, paid_at, stripe_payment_ref, starts_at, ends_at, impressions, clicks"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("ad_stats_daily")
        .select("ad_id, slot, impressions, clicks")
        .gte("day", since),
    ]);
    const loaded = (adsRes.data as Row[]) ?? [];
    // Surface anything needing a decision (applied/approved) at the top.
    loaded.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    setRows(loaded);

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
    // Admin-created ads go live immediately (status active) — that matches how
    // the console worked before the state machine existed.
    const { error } = await supabase.from("advertisers").insert({
      business_name: form.business_name.trim(),
      tagline: form.tagline.trim() || null,
      image_url: form.image_url.trim(),
      link_url: form.link_url.trim(),
      placement: form.placement,
      weight: Number(form.weight) || 1,
      status: "active",
      active: true,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    });
    if (error) return setError(error.message);
    setForm({
      business_name: "",
      tagline: "",
      image_url: "",
      link_url: "",
      placement: "banner",
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

  // Move an ad to a new lifecycle state, keeping the legacy `active` boolean in
  // sync so anything still reading it agrees with `status`.
  const setStatus = (id: string, status: AdStatus) =>
    patch(id, { status, active: status === "active" });

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
        <label className="flex items-center gap-2 text-sm font-bold">
          Placement
          <select
            className={input}
            value={form.placement}
            onChange={(e) =>
              setForm({ ...form, placement: e.target.value as AdPlacement })
            }
          >
            {(Object.keys(AD_SPECS) as AdPlacement[]).map((p) => (
              <option key={p} value={p}>
                {AD_SPECS[p].label} ({AD_SPECS[p].width}×{AD_SPECS[p].height})
              </option>
            ))}
          </select>
        </label>
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
                  <p className="flex flex-wrap items-center gap-2 font-display font-extrabold">
                    {r.business_name}
                    <span
                      className={`border-2 border-black px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_STYLE[r.status]}`}
                    >
                      {r.status}
                    </span>
                    <span className="border-2 border-black bg-white px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-black/60">
                      {AD_SPECS[r.placement].label}
                    </span>
                  </p>
                  <p className="truncate text-xs text-black/50">{r.link_url}</p>
                  {r.contact_email && (
                    <p className="truncate text-xs font-bold text-black/60">
                      ✉️ {r.contact_email}
                    </p>
                  )}
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
                {/* State machine: applied → approved → active ⇄ disabled. The
                    activate/disable pair is the "simple toggle" that puts a
                    paid ad live or takes it down. */}
                <div className="flex flex-wrap items-center gap-2">
                  {r.status === "applied" && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, "approved")}
                      className={actionBtn}
                    >
                      Approve / paid
                    </button>
                  )}
                  {(r.status === "approved" || r.status === "disabled") && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, "active")}
                      className={`${actionBtn} bg-[var(--green)] text-[var(--sand)]`}
                    >
                      Activate ▶
                    </button>
                  )}
                  {r.status === "active" && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, "disabled")}
                      className={actionBtn}
                    >
                      Disable ⏸
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="text-xs font-bold uppercase tracking-wide text-[var(--red)] hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Stripe pay link: generate one for an approved ad; paying it
                  auto-activates the ad via the webhook. Shows a paid marker once
                  Stripe has confirmed payment. */}
              {r.paid_at ? (
                <p className="border-t-2 border-dashed border-black/15 pt-2 text-xs font-black uppercase tracking-wide text-[var(--green)]">
                  💳 Paid {r.paid_at.slice(0, 10)}
                </p>
              ) : (
                r.status === "approved" && <AdPayLink advertiserId={r.id} />
              )}

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

// Per-ad Stripe pay-link generator, shown for approved ads. The admin enters
// the agreed amount; we mint a Checkout link (verified admin-side) they can
// send to the business. When it's paid, the webhook flips the ad to active.
function AdPayLink({ advertiserId }: { advertiserId: string }) {
  const [dollars, setDollars] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setError(null);
    setUrl(null);
    const amountCents = Math.round(parseFloat(dollars) * 100);
    if (!(amountCents >= 100)) return setError("Enter an amount of at least $1.");
    if (!supabase) return setError("Supabase isn't configured.");
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setBusy(false);
      return setError("Session expired — sign in again.");
    }
    const res = await createAdCheckoutSession({
      accessToken: token,
      advertiserId,
      amountCents,
    });
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setUrl(res.url);
  };

  return (
    <div className="flex flex-col gap-2 border-t-2 border-dashed border-black/15 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black uppercase tracking-wide text-black/50">
          💳 Pay link $
        </span>
        <input
          type="number"
          min={1}
          step="0.01"
          inputMode="decimal"
          placeholder="e.g. 50"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          className="w-24 border-2 border-black px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className={`${actionBtn} disabled:opacity-50`}
        >
          {busy ? "…" : "Create"}
        </button>
      </div>
      {error && <p className="text-xs font-bold text-[var(--red)]">{error}</p>}
      {url && (
        <div className="flex flex-col gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-xs font-bold text-[var(--turq)] underline"
          >
            {url}
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(url)}
            className="w-fit text-[10px] font-black uppercase tracking-wide text-black/50 hover:underline"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}

const input =
  "border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";

const actionBtn =
  "border-2 border-black bg-white px-2 py-1 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none";
