import type { Metadata } from "next";
import Link from "next/link";
import BusinessesAdmin from "@/components/admin/BusinessesAdmin";

export const metadata: Metadata = {
  title: "Business listings",
  robots: { index: false, follow: false },
};

export default function AdminBusinessesPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">Business listings</h1>
        <Link
          href="/admin/ads"
          className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
        >
          Advertisers →
        </Link>
      </div>
      <p className="text-sm font-bold text-black/60">
        Submissions from /list-your-business land here as pending. Approve to
        show them on Things to do immediately, or deny to keep them hidden.
      </p>
      <BusinessesAdmin />
    </div>
  );
}
