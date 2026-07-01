"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pickWeighted, type Ad } from "@/lib/ads";

// A single rotating ad slot. Fetches active advertisers directly from Supabase
// on the client so newly added/removed ads (via /admin/ads) appear immediately
// with no rebuild — even on statically rendered pages. Picks one weighted-random
// ad per load, records an impression, and routes clicks through /api/ads/click
// for tracking. Shows a subtle "advertise here" placeholder when empty.
export default function AdSlot({ label = "Local business" }: { label?: string }) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [ready, setReady] = useState(false);
  const counted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase
      .from("public_ads")
      .select("id, business_name, image_url, link_url, weight")
      .then(({ data }) => {
        if (cancelled) return;
        const ads: Ad[] = (data ?? []).map((a) => ({
          id: a.id,
          businessName: a.business_name,
          imageUrl: a.image_url,
          linkUrl: a.link_url,
          weight: a.weight ?? 1,
        }));
        const chosen = pickWeighted(ads);
        setAd(chosen);
        setReady(true);
        if (chosen && supabase && !counted.current) {
          counted.current = true;
          supabase
            .rpc("increment_ad_impression", { p_ad_id: chosen.id })
            .then(() => {}, () => {});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to show until we know (avoids a flash of the placeholder).
  if (!ready) return null;

  if (!ad) {
    return (
      <aside className="flex items-center justify-center border-[3px] border-dashed border-black/30 bg-white p-6 text-center text-xs font-bold uppercase tracking-wide text-black/40">
        Your business here — advertise to Dunedin dog owners
      </aside>
    );
  }

  return (
    <aside className="border-[3px] border-black bg-white shadow-hard">
      <a
        href={`/api/ads/click?id=${ad.id}`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block"
      >
        <div className="relative aspect-[3/1] w-full overflow-hidden border-b-[3px] border-black bg-zinc-100">
          {/* Advertiser-supplied image (self-hosted /assets or external) — plain
              img so any host works without next/image remote config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrl}
            alt={ad.businessName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="font-display text-sm font-extrabold">
            {ad.businessName}
          </span>
          <span className="border border-black bg-[var(--sand)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-black/50">
            {label} · Ad
          </span>
        </div>
      </a>
    </aside>
  );
}
