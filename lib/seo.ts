import {
  averageRating,
  DAYS_OF_WEEK,
  type Business,
  type BusinessHours,
} from "@/lib/businesses";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// JSON-LD builders. Everything here maps data that already renders on the
// page into schema.org vocabulary — no field is ever invented, and callers
// are responsible for only passing REAL (non-demo) data. Serialized via
// JSON.stringify, so returning `undefined` for an absent field drops it.

type JsonLdObject = Record<string, unknown>;

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: `${SITE_URL}/icon`,
    areaServed: {
      "@type": "City",
      name: "Dunedin",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Dunedin",
        addressRegion: "FL",
        addressCountry: "US",
      },
    },
  };
}

export function webSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

const DAY_LABELS: Record<keyof BusinessHours, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

// hours jsonb -> OpeningHoursSpecification[]. Only days that are actually
// open with both times present are emitted; undefined when nothing qualifies.
function openingHoursSpec(hours: BusinessHours | null): JsonLdObject[] | undefined {
  if (!hours) return undefined;
  const spec = DAYS_OF_WEEK.flatMap((day) => {
    const h = hours[day];
    if (!h || h.closed || !h.open || !h.close) return [];
    return [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: DAY_LABELS[day],
        opens: h.open,
        closes: h.close,
      },
    ];
  });
  return spec.length > 0 ? spec : undefined;
}

// One approved listing -> LocalBusiness. Emits only the fields that row
// actually carries; ratings come from the same community reviews the page
// renders.
function localBusinessJsonLd(b: Business): JsonLdObject {
  return {
    "@type": "LocalBusiness",
    name: b.name,
    description: b.description || undefined,
    address: b.address || undefined,
    telephone: b.phone || undefined,
    url: b.website || undefined,
    image: b.image
      ? b.image.startsWith("http")
        ? b.image
        : `${SITE_URL}${b.image}`
      : undefined,
    openingHoursSpecification: openingHoursSpec(b.hours),
    aggregateRating:
      b.reviews.length > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: averageRating(b.reviews),
            reviewCount: b.reviews.length,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };
}

// The /things-to-do guide as an ItemList of LocalBusiness. Callers must gate
// on live data (persistenceEnabled()) so demo seeds never reach search engines.
export function thingsToDoJsonLd(businesses: Business[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Dog-friendly things to do in Dunedin, FL",
    url: `${SITE_URL}/things-to-do`,
    itemListElement: businesses.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: localBusinessJsonLd(b),
    })),
  };
}
