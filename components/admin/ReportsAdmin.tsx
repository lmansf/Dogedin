"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseUser, AuthPanel, signOut } from "@/components/dogs/auth";

type ReportRow = {
  id: string;
  post_id: string;
  reporter_dog_id: string;
  reason: string | null;
  created_at: string;
  resolved: boolean;
};

type PostInfo = { id: string; photo_path: string; moderation_status: string; dog_id: string };

// Report queue for dog_posts (see supabase/schema.sql § 6). RLS restricts
// post_reports reads/updates to app_admins, same gate as /admin/posts and
// /admin/ads. Resolving a report just clears it from the open list; pulling
// the underlying photo (if warranted) is a separate delete on dog_posts.
export default function ReportsAdmin() {
  const { user, loading, configured } = useSupabaseUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [posts, setPosts] = useState<Record<string, PostInfo>>({});
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
      .from("post_reports")
      .select("id, post_id, reporter_dog_id, reason, created_at, resolved")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data as ReportRow[]) ?? [];
    setReports(rows);

    const postIds = [...new Set(rows.map((r) => r.post_id))];
    if (postIds.length > 0) {
      const { data: postRows } = await supabase
        .from("dog_posts")
        .select("id, photo_path, moderation_status, dog_id")
        .in("id", postIds);
      const postMap: Record<string, PostInfo> = {};
      for (const p of postRows ?? []) postMap[p.id] = p as PostInfo;
      setPosts(postMap);

      const dogIds = [...new Set((postRows ?? []).map((p) => p.dog_id))];
      if (dogIds.length > 0) {
        const { data: dogs } = await supabase
          .from("public_dog_profiles")
          .select("id, dog_name")
          .in("id", dogIds);
        setDogNames(Object.fromEntries((dogs ?? []).map((d) => [d.id, d.dog_name])));
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const resolve = async (report: ReportRow) => {
    if (!supabase) return;
    setBusy(report.id);
    const { error } = await supabase.from("post_reports").update({ resolved: true }).eq("id", report.id);
    setBusy(null);
    if (error) return setNotice(`Couldn't resolve: ${error.message}`);
    load();
  };

  const removePost = async (report: ReportRow) => {
    if (!supabase) return;
    setBusy(report.id);
    const photoPath = posts[report.post_id]?.photo_path;
    const { error } = await supabase.from("dog_posts").delete().eq("id", report.post_id);
    if (!error) {
      if (photoPath) await supabase.storage.from("dog-photos").remove([photoPath]);
      await supabase.from("post_reports").update({ resolved: true }).eq("id", report.id);
    }
    setBusy(null);
    if (error) return setNotice(`Couldn't remove post: ${error.message}`);
    setNotice("Post removed.");
    load();
  };

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in with an admin account to review reports." />;
  if (isAdmin === false)
    return (
      <div className="border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold">
          You&apos;re signed in as {user.email}, but that address isn&apos;t an
          admin. Add it to the <code>app_admins</code> table to review reports.
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

  const open = reports.filter((r) => !r.resolved);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-bold text-black/60">{open.length} open report(s)</p>
      {notice && (
        <p className="border-2 border-black bg-[var(--gold)]/25 px-3 py-2 text-sm font-bold">{notice}</p>
      )}
      {open.length === 0 && (
        <p className="border-[3px] border-black bg-white p-4 text-sm font-bold text-black/50 shadow-hard">
          Nothing reported.
        </p>
      )}
      {open.map((r) => {
        const post = posts[r.post_id];
        return (
          <div key={r.id} className="flex flex-col gap-3 border-[3px] border-black bg-white p-4 shadow-hard sm:flex-row">
            {post && (
              <p className="text-xs font-bold text-black/60">
                Post by {dogNames[post.dog_id] ?? "Unknown dog"} — status: {post.moderation_status}
              </p>
            )}
            <div className="min-w-0 flex-1">
              {r.reason && <p className="text-sm">{r.reason}</p>}
              <p className="mt-1 text-xs text-black/40">Reported {new Date(r.created_at).toLocaleString()}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => resolve(r)}
                disabled={busy !== null}
                className="border-2 border-black bg-[var(--sand)] px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => removePost(r)}
                disabled={busy !== null}
                className="border-2 border-black bg-[var(--coral)] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                Remove post
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
