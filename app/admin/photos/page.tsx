import type { Metadata } from "next";
import Link from "next/link";
import PhotosAdmin from "@/components/admin/PhotosAdmin";

export const metadata: Metadata = {
  title: "Photo queue",
  robots: { index: false, follow: false },
};

export default function AdminPhotosPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">Photo queue</h1>
        <div className="flex gap-3">
          <Link
            href="/admin/reports"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Reports →
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
        Photos members share to a dog&apos;s page wait here until approved.
        Normally the auto-moderator handles them; anything stuck pending
        (auto-moderation not set up, or it errored) can be approved, rejected
        or re-run by hand — see docs/photo-moderation-runbook.md.
      </p>
      <PhotosAdmin />
    </div>
  );
}
