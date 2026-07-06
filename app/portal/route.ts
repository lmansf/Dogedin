import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// dogedin.com/portal → the business portal on the media-kit deployment. A
// local stable URL the nav/signin page can link to without baking the other
// deployment's hostname into client bundles. When BUSINESS_PORTAL_URL isn't
// configured, fall back to /account (the shared sign-in) rather than
// /list-your-business — the submission success screen links here, so sending
// listers back to the form would loop them.
export function GET() {
  const portal = (process.env.BUSINESS_PORTAL_URL ?? "").replace(/\/$/, "");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return NextResponse.redirect(
    portal ? `${portal}/portal` : `${site}/account`,
    307
  );
}
