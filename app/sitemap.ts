import type { MetadataRoute } from "next";
import { listDogSlugs } from "@/lib/dogProfiles";
import { SITE_URL } from "@/lib/site";

// /sitemap.xml. Static routes always; public dog profiles when Supabase is
// configured (gracefully absent otherwise). Businesses have no detail pages —
// they live on /things-to-do, which is listed here. Excluded on purpose:
// /account (personal, sign-in gated), /card (redirects to /membership),
// /admin/* and /api/* (disallowed in robots).
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/things-to-do", priority: 0.9 },
  { path: "/dogs", priority: 0.8 },
  { path: "/register", priority: 0.8 },
  { path: "/shop", priority: 0.7 },
  { path: "/found", priority: 0.7 },
  { path: "/list-your-business", priority: 0.6 },
  { path: "/advertise", priority: 0.5 },
  { path: "/events", priority: 0.4 },
  { path: "/membership", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path === "/" ? "" : r.path}`,
    changeFrequency: "weekly",
    priority: r.priority,
  }));

  const dogs = await listDogSlugs();
  const dogEntries: MetadataRoute.Sitemap = dogs.map((d) => ({
    url: `${SITE_URL}/dog/${d.slug}`,
    lastModified: d.createdAt ? new Date(d.createdAt) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...dogEntries];
}
