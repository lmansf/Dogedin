"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { pickWeighted, type Ad, type AdPlacement } from "@/lib/ads";

// A single local-business ad slot. Fetches in-flight advertisers client-side
// from the public_ads view (so /admin/ads changes are live with no rebuild),
// picks one weighted-random ad per load, and reports to the slot-keyed daily
// stats:
//  - impressions are VIEWABILITY-GATED: counted once, only after >=50% of the
//    ad has been continuously on screen for >=1s (IntersectionObserver), so an
//    advertiser's numbers mean "a person actually saw this";
//  - clicks route through /api/ads/click?id=..&slot=.. (count + redirect).
//
// Two shapes: the 3:1 "banner" (feed pages) and a native "card" that mirrors
// the /things-to-do BusinessCard anatomy so it sits inside that grid as
// content, clearly labelled. When no advertiser is live, the slot renders a
// quiet invitation linking to /advertise.
export default function AdSlot({
  slot,
  variant = "banner",
  placement,
  label = "Local partner",
  hideWhenEmpty = false,
}: {
  slot: string;
  variant?: "banner" | "card";
  // Which placement type this slot serves. Defaults from the visual variant so
  // existing callers keep working: a "card" slot serves generic rectangles, a
  // "banner" slot serves banners. Set explicitly for ribbon strips.
  placement?: AdPlacement;
  label?: string;
  // When true, render nothing (not the "your business here" invitation) if no
  // ad is live. Used on the homepage so an empty site leads with community, not
  // solicitations; the /advertise link in the footer still drives acquisition.
  hideWhenEmpty?: boolean;
}) {
  const wantPlacement: AdPlacement =
    placement ?? (variant === "card" ? "generic" : "banner");
  const [ad, setAd] = useState<Ad | null>(null);
  const [ready, setReady] = useState(false);
  const boxRef = useRef<HTMLElement | null>(null);
  const counted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase
      .from("public_ads")
      .select(
        "id, business_name, tagline, image_url, mobile_image_url, link_url, weight, placement"
      )
      .eq("placement", wantPlacement)
      .then(({ data }) => {
        if (cancelled) return;
        const ads: Ad[] = (data ?? []).map((a) => ({
          id: a.id,
          businessName: a.business_name,
          tagline: a.tagline ?? null,
          imageUrl: a.image_url,
          mobileImageUrl: a.mobile_image_url ?? null,
          linkUrl: a.link_url,
          weight: a.weight ?? 1,
          placement: a.placement,
        }));
        setAd(pickWeighted(ads));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [wantPlacement]);

  // Viewability-gated impression: >=50% visible for >=1 continuous second.
  useEffect(() => {
    const el = boxRef.current;
    if (!ad || !el || !supabase || counted.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const record = () => {
      if (counted.current) return;
      counted.current = true;
      supabase
        ?.rpc("record_ad_impression", { p_ad_id: ad.id, p_slot: slot })
        .then(() => {}, () => {});
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.5) {
            if (!timer) timer = setTimeout(record, 1000);
          } else if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    io.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, [ad, slot]);

  // Nothing to show until we know (avoids a flash of the placeholder).
  if (!ready) return null;

  if (!ad) {
    // Homepage slots opt out of the invitation entirely so an empty site leads
    // with community, not "advertise here" boxes.
    if (hideWhenEmpty) return null;
    // A slim strip for the ribbon, a taller box for feed placements — so two
    // empty slots on one page never read as the same duplicated bar.
    const isRibbon = wantPlacement === "ribbon";
    return (
      <aside ref={boxRef as React.RefObject<HTMLElement>}>
        <Link
          href="/advertise"
          className={
            isRibbon
              ? "flex items-center justify-center border-2 border-dashed border-black/25 bg-white px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-black/40 transition-colors hover:border-black/60 hover:text-black/60"
              : "flex items-center justify-center border-[3px] border-dashed border-black/30 bg-white p-6 text-center text-xs font-bold uppercase tracking-wide text-black/40 transition-colors hover:border-black/60 hover:text-black/60"
          }
        >
          {isRibbon
            ? "Advertise on Dogedin — top of the page →"
            : "Your business here — reach Dunedin’s dog people →"}
        </Link>
      </aside>
    );
  }

  const clickHref = `/api/ads/click?id=${ad.id}&slot=${encodeURIComponent(slot)}`;

  if (variant === "card") {
    // Native card: same anatomy as a BusinessCard so it reads as content in the
    // /things-to-do grid — with an unmissable label so it reads honestly too.
    return (
      <aside ref={boxRef as React.RefObject<HTMLElement>} className="h-full">
        <a
          href={clickHref}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="flex h-full flex-col border-[3px] border-black bg-white shadow-hard transition-transform hover:-translate-y-1"
        >
          <div className="relative aspect-[16/9] border-b-[3px] border-black bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.imageUrl}
              alt={ad.businessName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute -right-2 -top-2 rotate-3 border-[3px] border-black bg-[var(--gold)] px-2 py-1 text-xs font-black shadow-hard">
              Sponsored
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-4">
            <span className="w-fit border-2 border-black bg-[var(--sand)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-black/70">
              {label} · Ad
            </span>
            <h3 className="font-display text-2xl font-extrabold leading-tight">
              {ad.businessName}
            </h3>
            {ad.tagline && (
              <p className="text-sm leading-relaxed text-black/70">{ad.tagline}</p>
            )}
            <span className="mt-auto pt-2 text-xs font-black uppercase tracking-wide text-[var(--turq)]">
              Visit →
            </span>
          </div>
        </a>
      </aside>
    );
  }

  return (
    <aside
      ref={boxRef as React.RefObject<HTMLElement>}
      className="border-[3px] border-black bg-white shadow-hard"
    >
      <a
        href={clickHref}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block"
      >
        <div className="w-full overflow-hidden border-b-[3px] border-black bg-white">
          {/* Advertiser-supplied creative at its exact spec size (validated at
              upload). Serve the 320x100 mobile variant on small screens when the
              advertiser supplied one, else the desktop leaderboard scales down.
              Plain img/picture so any host works without next/image config. */}
          <picture>
            {ad.mobileImageUrl && (
              <source media="(max-width: 640px)" srcSet={ad.mobileImageUrl} />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ad.imageUrl}
              alt={ad.businessName}
              className="mx-auto block h-auto w-full max-w-full"
              loading="lazy"
            />
          </picture>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="font-display text-sm font-extrabold">
            {ad.businessName}
          </span>
          <span className="border border-black bg-[var(--sand)] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-black/70">
            {label} · Ad
          </span>
        </div>
      </a>
    </aside>
  );
}
