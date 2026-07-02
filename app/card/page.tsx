import type { Metadata } from "next";
import Link from "next/link";
import DiscountCard from "@/components/membership/DiscountCard";

export const metadata: Metadata = {
  title: "My member card",
  robots: { index: false, follow: false },
};

export default function CardPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-center font-display text-3xl font-extrabold">
        Your member card
      </h1>
      <DiscountCard />
      <p className="text-center text-sm font-bold text-black/60">
        <Link
          href="/things-to-do"
          className="font-black text-[var(--turq)] underline"
        >
          Where your card works →
        </Link>
      </p>
    </div>
  );
}
