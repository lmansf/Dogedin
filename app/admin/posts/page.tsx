import type { Metadata } from "next";
import Link from "next/link";
import PostQueueAdmin from "@/components/admin/PostQueueAdmin";

export const metadata: Metadata = {
  title: "Dog of the day queue",
  robots: { index: false, follow: false },
};

export default function AdminPostsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">Dog of the day</h1>
        <Link
          href="/admin/ads"
          className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
        >
          Advertisers →
        </Link>
      </div>
      <p className="text-sm font-bold text-black/60">
        Each day the pipeline drafts the oldest registered dog that hasn&apos;t
        been featured, with an AI caption. Approve (edit the caption if you
        like) and it posts to Instagram on the next daily run.
      </p>
      <PostQueueAdmin />
    </div>
  );
}
