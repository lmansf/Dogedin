"use server";

import { revalidatePath, revalidateTag } from "next/cache";

// Called after an admin approves/denies a business so the change shows up right
// away instead of waiting for the guide's ISR window. The guide (/things-to-do)
// and homepage previews are otherwise-static pages that cache the listing set;
// the marquee/featured spot reads through the "businesses"-tagged unstable_cache
// (see lib/topBusiness.ts). Invalidate all three.
export async function refreshBusinessSurfaces(): Promise<void> {
  revalidatePath("/things-to-do");
  revalidatePath("/");
  revalidateTag("businesses");
}
