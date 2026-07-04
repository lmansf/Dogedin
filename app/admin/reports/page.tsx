import type { Metadata } from "next";
import Link from "next/link";
import ReportsAdmin from "@/components/admin/ReportsAdmin";

export const metadata: Metadata = {
  title: "Reported posts",
  robots: { index: false, follow: false },
};

export default function AdminReportsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">Reported posts</h1>
        <div className="flex gap-3">
          <Link
            href="/admin/photos"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Photo queue →
          </Link>
          <Link
            href="/admin/posts"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Dog of the day →
          </Link>
        </div>
      </div>
      <p className="text-sm font-bold text-black/60">
        Dogs (via their owners) can report a photo from another dog&apos;s
        feed. Dismiss if it&apos;s fine, or remove the post if it isn&apos;t.
      </p>
      <ReportsAdmin />
    </div>
  );
}
