import { supabase } from "@/lib/supabase";

// Pre-launch features (the Club, the events calendar) are hidden behind
// "coming soon" teasers. Every teaser interaction is counted per feature,
// per source, per day via a SECURITY DEFINER RPC — no PII, just a tally the
// analytics dashboard reads to decide what to build next. Fire-and-forget:
// tracking must never block navigation.
export function recordFeatureClick(feature: string, source: string) {
  supabase?.rpc("record_feature_click", { p_feature: feature, p_source: source }).then(
    () => {},
    () => {}
  );
}
