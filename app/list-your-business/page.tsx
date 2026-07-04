import type { Metadata } from "next";
import Link from "next/link";
import BusinessSubmissionForm from "@/components/spots/BusinessSubmissionForm";

export const metadata: Metadata = {
  title: "List your business",
  description:
    "Add your Dunedin, Florida business to the dog-friendly local guide — hours, directions and a card photo, reviewed before it goes live.",
};

export default function ListYourBusinessPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <section className="relative overflow-hidden border-[3px] border-black bg-[var(--turq)] p-6 shadow-hard-lg md:p-8">
        <div className="dots pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="inline-block -rotate-2 border-[3px] border-black bg-[var(--sand)] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-hard">
            🌴 For Dunedin businesses
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[0.95] text-[var(--sand)] md:text-5xl">
            List your business
          </h1>
          <p className="mt-3 max-w-lg font-bold text-[var(--sand)]/90">
            Get your dog-friendly spot in front of Dunedin&apos;s dog people on{" "}
            <Link href="/things-to-do" className="underline">
              Things to do
            </Link>
            . Add real hours and an address so visitors can get directions in
            one tap — every listing is reviewed before it goes live.
          </p>
        </div>
      </section>

      <BusinessSubmissionForm />
    </div>
  );
}
