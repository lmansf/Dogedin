import type { Metadata } from "next";
import AdInquiryForm from "@/components/ads/AdInquiryForm";

export const metadata: Metadata = {
  title: "Advertise with Dogedin",
  description:
    "Put your Dunedin business in front of the town's dog people — tasteful, clearly labelled spots with honest monthly reporting.",
};

const SLOTS = [
  {
    emoji: "🏠",
    name: "Homepage spotlight",
    where: "A banner between the community sections on the front page",
    why: "The whole pack passes through here — broadest reach in town.",
  },
  {
    emoji: "🗺",
    name: "Local guide featured spot",
    where: "A native card inside the Things-to-do grid, styled like the guide itself",
    why: "Shown to people actively planning where to eat, drink and play with their dog.",
  },
  {
    emoji: "📅",
    name: "Events week sponsor",
    where: "A banner under the town's dog events calendar",
    why: "Reaches people building their weekend plans.",
  },
];

const AD_FREE = [
  { path: "Lost-dog lookup & dog profiles", why: "a scared finder or worried owner should never see an ad" },
  { path: "Member cards", why: "that's a member's own pocket" },
  { path: "Registration & account pages", why: "people trusting us with their details" },
];

export default function AdvertisePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <section className="relative overflow-hidden border-[3px] border-black bg-[var(--navy)] p-6 shadow-hard-lg md:p-8">
        <div className="dots pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="inline-block -rotate-2 border-[3px] border-black bg-[var(--sand)] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-hard">
            🤝 For Dunedin businesses
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-[0.95] text-[var(--sand)] md:text-5xl">
            Advertise with Dogedin
          </h1>
          <p className="mt-3 max-w-lg font-bold text-[var(--sand)]/90">
            Dogedin is where Dunedin&apos;s dog people register their pups, plan
            their weekends and find their next favourite patio. Put your
            business in front of them — tastefully.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-extrabold">The spots</h2>
        {SLOTS.map((s) => (
          <div
            key={s.name}
            className="flex items-start gap-4 border-[3px] border-black bg-white p-4 shadow-hard"
          >
            <span className="text-3xl">{s.emoji}</span>
            <div>
              <h3 className="font-display text-lg font-extrabold">{s.name}</h3>
              <p className="text-sm font-semibold text-black/70">{s.where}</p>
              <p className="mt-1 text-sm text-black/60">{s.why}</p>
            </div>
          </div>
        ))}
        <p className="border-2 border-black bg-[var(--gold)]/25 px-3 py-2 text-sm font-bold">
          Simple flat monthly pricing, one advertiser per spot at a time, and an
          honest monthly report: how many neighbours actually saw your ad (we
          only count an impression once it&apos;s truly on screen), how many
          tapped through, per placement.
        </p>
      </section>

      <section className="border-[3px] border-black bg-white p-5 shadow-hard">
        <h2 className="font-display text-2xl font-extrabold">
          Where ads never run
        </h2>
        <p className="mt-1 text-sm text-black/60">
          This site serves the pack first. Some corners stay quiet, always:
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {AD_FREE.map((a) => (
            <li key={a.path} className="flex items-start gap-2 text-sm">
              <span aria-hidden>🚫</span>
              <span>
                <span className="font-extrabold">{a.path}</span>{" "}
                <span className="text-black/60">— {a.why}.</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <AdInquiryForm />
    </div>
  );
}
