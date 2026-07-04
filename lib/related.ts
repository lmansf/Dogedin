// Internal-linking engine for the "keep exploring" module (Workstream C).
//
// Goal: no page is a dead end. Given the current path, surface a few
// contextually RELEVANT onward links, biased toward pages where a visitor can
// spend — with an extra push toward commerce from pages that sell nothing
// themselves. Relevance is a hard requirement: a destination only appears if it
// shares a topic with the current page, so we never staple a shop link onto an
// unrelated page. The commerce bias is deterministic and capped, so it helps
// time-on-site and SEO rather than reading as ad clutter.

export type Destination = {
  href: string;
  label: string;
  blurb: string;
  commerce: boolean;
  topics: string[];
};

type PageProfile = { topics: string[]; commerce: boolean };

// Onward destinations. `commerce: true` marks pages where money can change
// hands (or ad inventory is sold) — those get the recommendation weight.
const DESTINATIONS: Destination[] = [
  {
    href: "/shop",
    label: "The shop",
    blurb: "Dogedin gear that funds the pack",
    commerce: true,
    topics: ["shop", "dogs", "community", "local"],
  },
  {
    href: "/advertise",
    label: "Advertise with us",
    blurb: "Put your business in front of Dunedin's dog people",
    commerce: true,
    topics: ["business", "local"],
  },
  {
    href: "/things-to-do",
    label: "Things to do in Dunedin",
    blurb: "Dog-friendly patios, beaches and trails",
    commerce: false,
    topics: ["local", "food", "outdoors", "business", "community"],
  },
  {
    href: "/dogs",
    label: "Meet the pack",
    blurb: "Browse Dunedin's registered good dogs",
    commerce: false,
    topics: ["dogs", "community"],
  },
  {
    href: "/register",
    label: "Register your dog",
    blurb: "A free profile and a lost-dog tag",
    commerce: false,
    topics: ["dogs", "community"],
  },
  {
    href: "/events",
    label: "What's on",
    blurb: "Dog-friendly happenings around town",
    commerce: false,
    topics: ["events", "community", "local"],
  },
  {
    href: "/list-your-business",
    label: "List your business",
    blurb: "Get your dog-friendly spot in the guide — free",
    commerce: false,
    topics: ["business", "local"],
  },
];

// What each page is "about", and whether it already sells something. Dynamic
// routes are matched by their section prefix in profileFor().
const PAGE_PROFILES: Record<string, PageProfile> = {
  "/": { topics: ["dogs", "community", "local", "shop", "events"], commerce: true },
  "/things-to-do": { topics: ["local", "food", "outdoors", "business", "community"], commerce: false },
  "/dogs": { topics: ["dogs", "community"], commerce: false },
  "/dog": { topics: ["dogs", "community", "local"], commerce: false },
  "/register": { topics: ["dogs", "community"], commerce: false },
  "/account": { topics: ["dogs", "community"], commerce: false },
  "/found": { topics: ["dogs", "local", "community"], commerce: false },
  "/events": { topics: ["events", "community", "local"], commerce: false },
  "/shop": { topics: ["shop", "dogs", "community"], commerce: true },
  "/membership": { topics: ["community", "shop", "dogs"], commerce: true },
  "/advertise": { topics: ["business", "local"], commerce: true },
  "/list-your-business": { topics: ["business", "local"], commerce: false },
};

// Top-level section of a path, e.g. "/things-to-do/foo" -> "/things-to-do".
function sectionOf(pathname: string): string {
  const clean = pathname.split("?")[0].split("#")[0];
  const seg = clean.split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

function profileFor(pathname: string): PageProfile {
  const section = sectionOf(pathname);
  return (
    PAGE_PROFILES[section] ??
    // Unknown page: assume community/local so it still gets relevant links.
    { topics: ["community", "local", "dogs"], commerce: false }
  );
}

// The onward links for a page: relevant (shared topic), commerce-weighted, and
// capped. From a non-commerce page we guarantee at least one commerce link so
// there's always a path toward a purchase — but only a topically relevant one.
export function relatedFor(pathname: string, limit = 3): Destination[] {
  const profile = profileFor(pathname);
  const currentSection = sectionOf(pathname);

  const scored = DESTINATIONS.filter((d) => sectionOf(d.href) !== currentSection)
    .map((d) => {
      const overlap = d.topics.filter((t) => profile.topics.includes(t)).length;
      // Commerce pages pull harder from pages that sell nothing themselves.
      const commerceBoost = d.commerce ? (profile.commerce ? 1 : 3) : 0;
      return { d, overlap, score: overlap * 2 + commerceBoost };
    })
    // Relevance guard: never surface an unrelated destination.
    .filter((x) => x.overlap >= 1)
    .sort((a, b) => b.score - a.score || a.d.label.localeCompare(b.d.label));

  let picks = scored.slice(0, limit);

  // Commerce-weighting guarantee for non-commerce pages: if the top-N happened
  // to be all non-commerce, promote the most relevant commerce destination.
  if (!profile.commerce && !picks.some((x) => x.d.commerce)) {
    const topCommerce = scored.find((x) => x.d.commerce);
    if (topCommerce)
      picks = [topCommerce, ...picks.filter((x) => x !== topCommerce)].slice(0, limit);
  }

  return picks.map((x) => x.d);
}
