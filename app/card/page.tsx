import type { Metadata } from "next";
import DiscountCard from "@/components/membership/DiscountCard";

export const metadata: Metadata = {
  title: "My discount card · Dogedin",
  robots: { index: false, follow: false },
};

export default function CardPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="text-center font-display text-3xl font-extrabold">
        Your member card
      </h1>
      <DiscountCard />
    </div>
  );
}
