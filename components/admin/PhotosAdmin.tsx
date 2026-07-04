"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dogPhotoUrl } from "@/lib/dogProfiles";
import { useSupabaseUser, AuthPanel, signOut } from "@/components/dogs/auth";

type PendingPost = {
  id: string;
  dog_id: string;
  photo_path: string;
  caption: string | null;
  created_at: string;
};

// Manual moderation queue for dog_posts (see supabase/schema.sql § 6 and
// docs/photo-moderation-runbook.md). Uploads always land 'pending'; the
// moderate-photo Edge Function normally approves/rejects them, but it fails
// CLOSED — if it isn't deployed or ANTHROPIC_API_KEY isn't set, every photo
// sits pending forever. This queue is the manual path: RLS restricts reads
// and the approve/reject writes to app_admins ("admins read all posts" /
// "admins moderate posts"). Reject mirrors moderate-photo: flip the row to
// 'rejected' AND delete the storage object so nothing lingers in the bucket.
export default function PhotosAdmin() {
  const { user, loading, configured } = useSupabaseUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [dogNames, setDogNames] = useState<Record<string, string>>({});
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
      .from("dog_posts")
      .select("id, dog_id, photo_path, caption, created_at")
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data as PendingPost[]) ?? [];
    setPosts(rows);

    const dogIds = [...new Set(rows.map((p) => p.dog_id))];
    if (dogIds.length > 0) {
      const { data: dogs } = await supabase
        .from("public_dog_profiles")
        .select("id, dog_name")
        .in("id", dogIds);
      setDogNames(Object.fromEntries((dogs ?? []).map((d) => [d.id, d.dog_name])));
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // .select() on the update so a silent zero-row match (e.g. schema.sql not
  // re-run, so the admin RLS policies are missing) surfaces instead of
  // looking like success.
  const setStatus = async (post: PendingPost, status: "approved" | "rejected") => {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("dog_posts")
      .update({ moderation_status: status })
      .eq("id", post.id)
      .select("id");
    if (error) return error.message;
    if (!data || data.length === 0)
      return "No row updated — re-run supabase/schema.sql so the admin policies exist.";
    return null;
  };

  const approve = async (post: PendingPost) => {
    setBusy(post.id);
    setNotice(null);
    const err = await setStatus(post, "approved");
    setBusy(null);
    if (err) return setNotice(`Couldn't approve: ${err}`);
    setNotice("Approved — it's live on the dog's page.");
    load();
  };

  const reject = async (post: PendingPost) => {
    if (!supabase) return;
    setBusy(post.id);
    setNotice(null);
    const err = await setStatus(post, "rejected");
    if (err) {
      setBusy(null);
      return setNotice(`Couldn't reject: ${err}`);
    }
    // Same as moderate-photo's reject path: don't leave the object in the
    // public bucket. The row stays 'rejected' so the owner sees the outcome.
    const { error: rmErr } = await supabase.storage
      .from("dog-photos")
      .remove([post.photo_path]);
    setBusy(null);
    setNotice(
      rmErr
        ? `Rejected, but the photo file couldn't be deleted: ${rmErr.message}`
        : "Rejected and photo deleted."
    );
    load();
  };

  const retryAuto = async (post: PendingPost) => {
    if (!supabase) return;
    setBusy(post.id);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke("moderate-photo", {
        body: { post_id: post.id },
      });
      if (error) throw error;
      const status = (data as { status?: string } | null)?.status;
      setNotice(
        status && status !== "pending"
          ? `Auto-moderation says: ${status}.`
          : "Auto-moderation ran but the post is still pending."
      );
    } catch {
      setNotice(
        "Auto-moderation isn't reachable (function not deployed or ANTHROPIC_API_KEY missing) — approve or reject manually."
      );
    }
    setBusy(null);
    load();
  };

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in with an admin account to review photos." />;
  if (isAdmin === false)
    return (
      <div className="border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold">
          You&apos;re signed in as {user.email}, but that address isn&apos;t an
          admin. Add it to the <code>app_admins</code> table to review photos.
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
      <p className="text-sm font-bold text-black/60">{posts.length} photo(s) waiting</p>
      {notice && (
        <p className="border-2 border-black bg-[var(--gold)]/25 px-3 py-2 text-sm font-bold">{notice}</p>
      )}
      {posts.length === 0 && (
        <p className="border-[3px] border-black bg-white p-4 text-sm font-bold text-black/50 shadow-hard">
          No photos waiting for review.
        </p>
      )}
      {posts.map((p) => {
        const photoUrl = dogPhotoUrl(p.photo_path);
        return (
          <div
            key={p.id}
            className="flex flex-col gap-3 border-[3px] border-black bg-white p-4 shadow-hard sm:flex-row"
          >
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={p.caption ?? `Pending photo from ${dogNames[p.dog_id] ?? "a dog"}`}
                className="h-32 w-32 shrink-0 border-2 border-black object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{dogNames[p.dog_id] ?? "Unknown dog"}</p>
              {p.caption && <p className="mt-1 text-sm">{p.caption}</p>}
              <p className="mt-1 text-xs text-black/40">
                Uploaded {new Date(p.created_at).toLocaleString()} · {timeAgo(p.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 flex-row flex-wrap gap-2 sm:flex-col">
              <button
                type="button"
                onClick={() => approve(p)}
                disabled={busy !== null}
                className="border-2 border-black bg-[var(--green)] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => reject(p)}
                disabled={busy !== null}
                className="border-2 border-black bg-[var(--coral)] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => retryAuto(p)}
                disabled={busy !== null}
                className="border-2 border-black bg-[var(--sand)] px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                Retry auto
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
