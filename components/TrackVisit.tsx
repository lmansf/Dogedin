"use client";

import { useEffect } from "react";
import { recordFeatureClick } from "@/lib/featureInterest";

// Counts a direct landing on a "coming soon" page (source: 'visit') so
// bookmarked/typed-in arrivals show up alongside teaser clicks. Once per
// feature per app load — the module-level set also absorbs dev double-mounts.
const seen = new Set<string>();

export default function TrackVisit({ feature }: { feature: string }) {
  useEffect(() => {
    if (seen.has(feature)) return;
    seen.add(feature);
    recordFeatureClick(feature, "visit");
  }, [feature]);
  return null;
}
