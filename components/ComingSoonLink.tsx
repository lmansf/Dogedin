"use client";

import Link from "next/link";
import { recordFeatureClick } from "@/lib/featureInterest";

// A link to a pre-launch feature's "coming soon" page that counts the click,
// tagged with which feature was teased and where on the site the teaser sat.
// Drop-in for <Link> so server components keep their markup and get tracking.
export default function ComingSoonLink({
  feature,
  source,
  href,
  className,
  children,
}: {
  feature: string;
  source: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => recordFeatureClick(feature, source)}
    >
      {children}
    </Link>
  );
}
