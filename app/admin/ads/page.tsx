import type { Metadata } from "next";
import AdsAdmin from "@/components/ads/AdsAdmin";

export const metadata: Metadata = {
  title: "Manage advertisers",
  robots: { index: false, follow: false },
};

export default function AdminAdsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-4xl font-extrabold">Advertisers</h1>
      <p className="text-sm font-bold text-black/60">
        Add, edit, pause or remove local-business ad slots. Changes are live
        immediately — no deploy needed.
      </p>
      <AdsAdmin />
    </div>
  );
}
