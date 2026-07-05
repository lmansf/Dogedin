import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// dogedin.com/portal → the business portal on the media-kit deployment. A
// local stable URL the nav/signin page can link to without baking the other
// deployment's hostname into client bundles. Falls back to the listing form
// when BUSINESS_PORTAL_URL isn't configured, so the link is never a dead end.
export function GET() {
  const portal = (process.env.BUSINESS_PORTAL_URL ?? "").replace(/\/$/, "");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return NextResponse.redirect(
    portal ? `${portal}/portal` : `${site}/list-your-business`,
    307
  );
}
