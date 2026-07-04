"use client";

import Link from "next/link";
import { useIsAdmin, AuthPanel, signOut } from "@/components/dogs/auth";

// The management console landing. Reuses the same "My Dogs" sign-in as the rest
// of the site and is shown ONLY to admin-role accounts (app_admins). A signed-in
// non-admin sees a clear "not an admin" notice, not the console; a visitor sees
// the sign-in panel. RLS is the real guard — this only decides what to render.
const TOOLS = [
  { href: "/admin/ads", title: "Ad console", blurb: "Approve, activate & toggle paid ad slots", icon: "📢" },
  { href: "/admin/inquiries", title: "Ad inquiries", blurb: "Leads from the advertise form", icon: "✉️" },
  { href: "/admin/businesses", title: "Business listings", blurb: "Approve local-guide submissions", icon: "🏪" },
  { href: "/admin/photos", title: "Photo queue", blurb: "Approve / reject dog photos", icon: "🐶" },
  { href: "/admin/posts", title: "Dog of the day", blurb: "Curate the Instagram queue", icon: "⭐" },
  { href: "/admin/reports", title: "Reports", blurb: "Flagged content & moderation", icon: "🚩" },
];

export default function AdminHome() {
  const { user, loading, configured, isAdmin } = useIsAdmin();

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return <AuthPanel intro="Sign in with an admin account to open the console." />;
  if (isAdmin === null)
    return <p className="text-sm font-bold text-black/50">Checking access…</p>;
  if (isAdmin === false)
    return (
      <div className="border-[3px] border-black bg-white p-6 shadow-hard">
        <p className="text-sm font-bold">
          You&apos;re signed in as {user.email}, but that address isn&apos;t an
          admin. Add it to the <code>app_admins</code> table to open the console.
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {TOOLS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="flex items-start gap-3 border-[3px] border-black bg-white p-4 shadow-hard transition-transform hover:-translate-y-1"
        >
          <span className="text-2xl" aria-hidden>
            {t.icon}
          </span>
          <span>
            <span className="block font-display text-lg font-extrabold">
              {t.title}
            </span>
            <span className="block text-sm text-black/60">{t.blurb}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
