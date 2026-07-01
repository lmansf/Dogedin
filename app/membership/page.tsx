import type { Metadata } from "next";
import MembershipCta from "@/components/membership/MembershipCta";
import { membershipPriceLabel } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Dogedin Club membership · Dogedin",
  description:
    "Join the Dogedin Club for a digital discount card and member perks at local Dunedin businesses.",
};

const PERKS = [
  { emoji: "🎟", text: "A digital discount card for perks at participating Dunedin businesses" },
  { emoji: "🍺", text: "Member-only deals at breweries, cafés and pet shops" },
  { emoji: "🏖", text: "Early access to community events & meetups" },
  { emoji: "🐾", text: "Support a local, dog-obsessed small business" },
];

export default function MembershipPage() {
  const configured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="border-[3px] border-black bg-[var(--red)] p-6 shadow-hard-lg md:p-8">
        <h1 className="font-display text-4xl font-extrabold leading-tight text-[var(--sand)] md:text-6xl">
          Join the Dogedin Club
        </h1>
        <p className="mt-3 max-w-xl font-bold text-[var(--sand)]/90">
          A digital discount card in your pocket and perks all over Dunedin —{" "}
          <span className="border-2 border-black bg-[var(--gold)] px-2 text-[var(--ink)]">
            {membershipPriceLabel}
          </span>
          .
        </p>
      </section>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PERKS.map((p) => (
          <li
            key={p.text}
            className="flex items-start gap-3 border-[3px] border-black bg-white p-4 shadow-hard"
          >
            <span className="text-2xl">{p.emoji}</span>
            <span className="text-sm font-semibold">{p.text}</span>
          </li>
        ))}
      </ul>

      {!configured && (
        <p className="border-[3px] border-black bg-[var(--gold)]/30 px-4 py-3 text-sm font-bold">
          💳 Payments aren&apos;t connected yet — set{" "}
          <code className="border border-black bg-white px-1">STRIPE_SECRET_KEY</code>
          ,{" "}
          <code className="border border-black bg-white px-1">STRIPE_PRICE_ID</code>{" "}
          and the webhook to enable checkout.
        </p>
      )}

      <MembershipCta />
    </div>
  );
}
