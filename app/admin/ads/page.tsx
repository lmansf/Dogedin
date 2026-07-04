import type { Metadata } from "next";
import AdsAdmin from "@/components/ads/AdsAdmin";

export const metadata: Metadata = {
  title: "Manage advertisers",
  robots: { index: false, follow: false },
};

export default function AdminAdsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">Advertisers</h1>
        <div className="flex gap-3">
          <a
            href="/admin/inquiries"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Inquiries →
          </a>
          <a
            href="/admin/businesses"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Business listings →
          </a>
          <a
            href="/admin/posts"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Dog of the day →
          </a>
        </div>
      </div>
      <p className="text-sm font-bold text-black/60">
        Add, edit, pause or remove local-business ad slots. Changes are live
        immediately — no deploy needed.
      </p>
      <AdsAdmin />
    </div>
  );
}
