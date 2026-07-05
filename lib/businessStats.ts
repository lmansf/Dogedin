import { supabase } from "@/lib/supabase";

// Fire-and-forget engagement counters for business listings (see
// supabase/schema.sql § 8, business_stats_daily). These power the paid
// "Business Insights" portal on the media-kit site. Counts are aggregate
// per-business/per-day only — no visitor identity is ever recorded. The RPC
// whitelists stat names and only counts approved businesses server-side, so a
// stray call can't mint junk rows. Failures are swallowed: analytics must
// never break the page.
export type BusinessStat =
  | "view"
  | "website"
  | "phone"
  | "directions"
  | "offer_unlock";

export function recordBusinessStat(businessId: string, stat: BusinessStat): void {
  if (!supabase || !businessId) return;
  supabase
    .rpc("record_business_stat", { p_business_id: businessId, p_stat: stat })
    .then(
      () => {},
      () => {}
    );
}
