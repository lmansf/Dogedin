import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Ad click tracker + redirect. Links in AdSlot point here
// (/api/ads/click?id=…&slot=…); we atomically bump the lifetime + per-slot
// daily click counters (the RPC returns the advertiser's destination) and
// forward the visitor on. Only http(s) destinations are honoured so a bad row
// can't turn this into an open redirect to odd schemes.
export async function GET(req: NextRequest) {
  const home = new URL("/", req.url);
  const id = req.nextUrl.searchParams.get("id");
  const slot = req.nextUrl.searchParams.get("slot") ?? "unknown";
  if (!id || !supabase) return NextResponse.redirect(home);

  try {
    const { data, error } = await supabase.rpc("record_ad_click", {
      p_ad_id: id,
      p_slot: slot,
    });
    const target = typeof data === "string" ? data : null;
    if (error || !target || !/^https?:\/\//i.test(target)) {
      return NextResponse.redirect(home);
    }
    return NextResponse.redirect(target);
  } catch {
    return NextResponse.redirect(home);
  }
}
