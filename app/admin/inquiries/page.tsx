import type { Metadata } from "next";
import Link from "next/link";
import InquiriesAdmin from "@/components/admin/InquiriesAdmin";

export const metadata: Metadata = {
  title: "Ad inquiries",
  robots: { index: false, follow: false },
};

export default function AdminInquiriesPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">Ad inquiries</h1>
        <div className="flex gap-3">
          <Link
            href="/admin/ads"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Advertisers →
          </Link>
          <Link
            href="/admin/businesses"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Business listings →
          </Link>
        </div>
      </div>
      <p className="text-sm font-bold text-black/60">
        Messages from the /advertise form land here, newest first. Reply by
        email; when a deal is agreed, set the ad up under Advertisers.
      </p>
      <InquiriesAdmin />
    </div>
  );
}
