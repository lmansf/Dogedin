import type { Metadata } from "next";
import AdInquiryForm from "@/components/ads/AdInquiryForm";
import { AD_LOCATIONS, AD_SPECS, AD_CREATIVE_TYPES, formatUsd } from "@/lib/ads";
import { confirmAdPaymentBySession } from "@/lib/confirmAdPayment";

export const metadata: Metadata = {
  title: "Advertise with Dogedin",
  description:
    "Put your Dunedin, FL business in front of the town's dog people — tasteful, clearly labelled spots with honest monthly reporting.",
};

// Per-location marketing copy (emoji + pitch), keyed by the location id in
// lib/ads.ts so the dimensions/specs come from the single source of truth and
// can never drift from what the form actually enforces.
const PITCH: Record<string, { emoji: string; why: string }> = {
  home_feed: {
    emoji: "🏠",
    why: "The whole pack passes through here — broadest reach in town.",
  },
  home_ribbon: {
    emoji: "🎗",
    why: "A slim strip up top — always in view as people land on the site.",
  },
  ttd_grid: {
    emoji: "🗺",
    why: "Shown to people actively planning where to eat, drink and play with their dog.",
  },
};

// Human-readable file formats (image/jpeg → JPG …) for the spec sheet.
const FORMATS = AD_CREATIVE_TYPES.map((t) => t.split("/")[1].toUpperCase())
  .join(" / ")
  .replace("JPEG", "JPG");

const AD_FREE = [
  { path: "Lost-dog lookup & dog profiles", why: "a scared finder or worried owner should never see an ad" },
  { path: "Member cards", why: "that's a member's own pocket" },
  { path: "Registration & account pages", why: "people trusting us with their details" },
];

export default async function AdvertisePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; canceled?: string; session_id?: string }>;
}) {
  const { paid, canceled, session_id } = await searchParams;
  // Returning from a successful Checkout: verify the payment with Stripe and
  // flip the ad live right now, so it doesn't depend on the webhook firing.
  if (paid === "1" && session_id) {
    await confirmAdPaymentBySession(session_id);
  }

  // On a successful return from Checkout, show a focused confirmation only —
  // re-rendering the whole spec sheet and inquiry form below a "payment
  // received" banner reads as "did it not work? do I fill this in again?".
  if (paid === "1") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="border-[3px] border-black bg-[var(--green)] p-6 text-center shadow-hard-lg">
          <p className="font-display text-2xl font-extrabold text-[var(--sand)]">
            🎉 Payment received — hang tight!
          </p>
          <p className="mt-2 text-sm font-bold text-[var(--sand)]/90">
            Your ad goes live within a minute — it takes a moment for the payment
            to confirm — or on your first booked day if you scheduled it ahead. It
            then runs through your last day and switches off on its own. Nothing
            more to do — thanks for supporting the pack! 🐾
          </p>
          <a
            href="/"
            className="mt-5 inline-block border-[3px] border-black bg-[var(--sand)] px-5 py-2 text-sm font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            Back to Dogedin
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      {canceled === "1" && (
        <div className="border-[3px] border-black bg-[var(--gold)]/30 p-4 text-center shadow-hard">
          <p className="text-sm font-black uppercase tracking-wide">
            Checkout canceled — your ad hasn&apos;t run and you weren&apos;t
            charged. Finish the form below whenever you&apos;re ready.
          </p>
        </div>
      )}
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
        <h2 className="font-display text-2xl font-extrabold">
          The spots &amp; their graphics specs
        </h2>
        <p className="text-sm text-black/60">
          Build your artwork to the exact size below and it&apos;ll be accepted
          on the form and go live automatically as soon as it clears a quick,
          automated content check. Everything is {FORMATS}.
        </p>

        {AD_LOCATIONS.map((loc) => {
          const spec = AD_SPECS[loc.placement];
          const pitch = PITCH[loc.id];
          return (
            <div
              key={loc.id}
              className="flex items-start gap-4 border-[3px] border-black bg-white p-4 shadow-hard"
            >
              <span className="text-3xl" aria-hidden>
                {pitch?.emoji ?? "📢"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-extrabold">{loc.name}</h3>
                  {/* Per-type daily price, priced by prominence. */}
                  <span className="shrink-0 -rotate-1 border-2 border-black bg-[var(--gold)] px-2 py-0.5 text-sm font-black shadow-hard">
                    {formatUsd(spec.dailyCents)}
                    <span className="text-xs font-bold">/day</span>
                  </span>
                </div>
                <p className="text-sm font-semibold text-black/70">{loc.where}</p>
                {pitch?.why && (
                  <p className="mt-1 text-sm text-black/60">{pitch.why}</p>
                )}
                {/* The dimension helper the businesses need. */}
                <dl className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  <SpecChip label="Size" value={`${spec.width} × ${spec.height} px`} />
                  {spec.mobile && (
                    <SpecChip
                      label="Mobile"
                      value={`${spec.mobile.width} × ${spec.mobile.height} px`}
                    />
                  )}
                  <SpecChip label="Format" value={FORMATS} />
                  <SpecChip
                    label="Max size"
                    value={`${Math.round(spec.maxBytes / 1024)} KB`}
                  />
                </dl>
              </div>
            </div>
          );
        })}

        {/* Not-yet-purchasable — kept here so businesses know it's coming. */}
        <div className="flex items-start gap-4 border-[3px] border-dashed border-black/40 bg-white/60 p-4">
          <span className="text-3xl" aria-hidden>
            📅
          </span>
          <div>
            <h3 className="font-display text-lg font-extrabold">
              Events week sponsor{" "}
              <span className="text-sm font-bold text-black/40">(coming soon)</span>
            </h3>
            <p className="text-sm font-semibold text-black/70">
              A banner under the town&apos;s dog events calendar, once it launches.
            </p>
            <p className="mt-1 text-sm text-black/60">
              Reaches people building their weekend plans. Not for sale until the
              calendar is live — same banner size ({AD_SPECS.banner.width} ×{" "}
              {AD_SPECS.banner.height} px) when it opens.
            </p>
          </div>
        </div>

        <p className="border-2 border-black bg-[var(--gold)]/25 px-3 py-2 text-sm font-bold">
          Simple daily pricing — pick your dates and pay only for the days you
          run (a week, a weekend, or a whole month). One advertiser per spot at a
          time, and an honest report: how many neighbours actually saw your ad
          (we only count an impression once it&apos;s truly on screen) and how
          many tapped through, per placement.
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

// A labelled spec value, e.g. "Size · 728 × 90 px".
function SpecChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 border-2 border-black bg-[var(--sand)] px-2 py-1">
      <dt className="uppercase tracking-wide text-black/50">{label}</dt>
      <dd className="text-black">{value}</dd>
    </div>
  );
}
