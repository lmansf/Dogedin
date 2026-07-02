"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser, AuthPanel, signOut } from "@/components/dogs/auth";

type QueueRow = {
  id: string;
  dog_id: string;
  caption: string;
  photo_url: string;
  status: "pending" | "approved" | "rejected" | "published" | "failed";
  ig_permalink: string | null;
  error: string | null;
  created_at: string;
  published_at: string | null;
};

// Review queue for the daily "dog of the day" Instagram post. Pending drafts
// show the photo + an editable caption with Approve / Reject; approved posts
// go out automatically on the next daily tick (or immediately via "Publish
// now"); failed posts surface their error with a Retry. RLS restricts this
// table to app_admins; publishing runs in Edge Functions via
// supabase.functions.invoke (the user's JWT rides along and is re-checked
// server-side).
export default function PostQueueAdmin() {
  const { user, loading, configured } = useSupabaseUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [dogNames, setDogNames] = useState<Record<string, string>>({});
  const [captions, setCaptions] = useState<Record<string, string>>({});
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
      .from("post_queue")
      .select(
        "id, dog_id, caption, photo_url, status, ig_permalink, error, created_at, published_at"
      )
      .order("created_at", { ascending: false })
      .limit(30);
    const queue = (data as QueueRow[]) ?? [];
    setRows(queue);
    setCaptions((prev) => {
      const next = { ...prev };
      for (const r of queue) if (!(r.id in next)) next[r.id] = r.caption;
      return next;
    });

    const ids = [...new Set(queue.map((r) => r.dog_id))];
    if (ids.length > 0) {
      const { data: dogs } = await supabase
        .from("public_dog_profiles")
        .select("id, dog_name")
        .in("id", ids);
      setDogNames(
        Object.fromEntries((dogs ?? []).map((d) => [d.id, d.dog_name]))
      );
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const review = async (row: QueueRow, status: "approved" | "rejected") => {
    if (!supabase || !user) return;
    setBusy(row.id);
    setNotice(null);
    const { error } = await supabase
      .from("post_queue")
      .update({
        caption: captions[row.id] ?? row.caption,
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", row.id);
    setBusy(null);
    if (error) return setNotice(`Couldn't save: ${error.message}`);
    setNotice(
      status === "approved"
        ? "Approved — it posts on the next daily run (or use Publish now)."
        : "Rejected — that dog won't be drafted again."
    );
    load();
  };

  const publishNow = async (row: QueueRow) => {
    if (!supabase) return;
    setBusy(row.id);
    setNotice(null);
    const { data, error } = await supabase.functions.invoke("publish-post", {
      body: { id: row.id },
    });
    setBusy(null);
    if (error) return setNotice(`Publish failed: ${error.message}`);
    setNotice(`Published! ${data?.permalink ?? ""}`);
    load();
  };

  const draftNext = async () => {
    if (!supabase) return;
    setBusy("draft");
    setNotice(null);
    const { data, error } = await supabase.functions.invoke("daily-post", {
      body: { draft_only: true },
    });
    setBusy(null);
    if (error) return setNotice(`Draft failed: ${error.message}`);
    setNotice(`Draft run: ${data?.draft ?? "done"}`);
    load();
  };

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in with an admin account to review posts." />;
  if (isAdmin === false)
    return (
      <div className="border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold">
          You&apos;re signed in as {user.email}, but that address isn&apos;t an
          admin. Add it to the <code>app_admins</code> table to review posts.
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-black/60">
          {pending.length} awaiting review
        </p>
        <button
          type="button"
          onClick={draftNext}
          disabled={busy !== null}
          className="border-[3px] border-black bg-[var(--gold)] px-4 py-2 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy === "draft" ? "Drafting…" : "Draft next dog now"}
        </button>
      </div>

      {notice && (
        <p className="border-2 border-black bg-[var(--gold)]/25 px-3 py-2 text-sm font-bold">
          {notice}
        </p>
      )}

      {pending.length === 0 && (
        <p className="border-[3px] border-black bg-white p-4 text-sm font-bold text-black/50 shadow-hard">
          Nothing waiting. The daily run drafts the oldest registered dog that
          hasn&apos;t been featured yet.
        </p>
      )}

      {pending.map((row) => (
        <div key={row.id} className="border-[3px] border-black bg-white p-4 shadow-hard">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.photo_url}
              alt={dogNames[row.dog_id] ?? "Dog"}
              className="h-48 w-48 shrink-0 border-2 border-black object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="font-display text-xl font-extrabold">
                {dogNames[row.dog_id] ?? "Unknown dog"}
              </p>
              <textarea
                value={captions[row.id] ?? row.caption}
                onChange={(e) =>
                  setCaptions((prev) => ({ ...prev, [row.id]: e.target.value }))
                }
                rows={6}
                maxLength={2200}
                className="w-full resize-y border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
              />
              <div className="flex flex-wrap gap-2">
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
                  onClick={() => review(row, "rejected")}
                  disabled={busy !== null}
                  className="border-[3px] border-black bg-[var(--red)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  Reject
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
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 border-2 border-black bg-white p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.photo_url}
                alt=""
                className="h-12 w-12 shrink-0 border-2 border-black object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">
                  {dogNames[row.dog_id] ?? "Unknown dog"}{" "}
                  <span
                    className={`ml-1 border border-black px-1.5 py-0.5 text-[10px] font-black uppercase ${
                      row.status === "published"
                        ? "bg-[var(--turq)] text-[var(--sand)]"
                        : row.status === "failed"
                          ? "bg-[var(--coral)] text-white"
                          : row.status === "approved"
                            ? "bg-[var(--gold)]"
                            : "bg-[var(--sand)] text-black/60"
                    }`}
                  >
                    {row.status}
                  </span>
                </p>
                {row.status === "failed" && row.error && (
                  <p className="truncate text-xs font-bold text-[var(--red)]">
                    {row.error}
                  </p>
                )}
              </div>
              {row.ig_permalink && (
                <a
                  href={row.ig_permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
                >
                  View post →
                </a>
              )}
              {(row.status === "approved" || row.status === "failed") && (
                <button
                  type="button"
                  onClick={() => publishNow(row)}
                  disabled={busy !== null}
                  className="border-2 border-black bg-[var(--gold)] px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {busy === row.id
                    ? "Publishing…"
                    : row.status === "failed"
                      ? "Retry"
                      : "Publish now"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
