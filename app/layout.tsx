import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import CartDrawer from "@/components/cart/CartDrawer";
import SiteNav from "@/components/SiteNav";
import ComingSoonLink from "@/components/ComingSoonLink";
import { Analytics } from "@vercel/analytics/next";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-display",
});

const body = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: "Dogedin — Dunedin, FL's club for dog lovers",
    template: "%s · Dogedin",
  },
  description:
    "The dog-owner community of Dunedin, Florida: dog profiles, lost-dog tags, a dog-friendly local guide and events on the Gulf coast — plus a wee shop that keeps the lights on.",
};

// Community leads; keep every line factual — no offers we don't run.
const MARQUEE = [
  "🐾 REGISTER YOUR GOOD DOG",
  "🚨 FOUND A DOG? LOOK UP THE TAG",
  "🍺 GOOD DOGS · GOOD BREWS",
  "📅 EVENTS CALENDAR — COMING SOON",
];

// Footer link columns: every community surface reachable from any page bottom.
// `soon` marks pre-launch destinations — clicks are counted as interest.
const FOOTER_COLS: {
  title: string;
  links: { href: string; label: string; soon?: string }[];
}[] = [
  {
    title: "The Pack",
    links: [
      { href: "/register", label: "Register your dog" },
      { href: "/dogs", label: "Find a dog" },
      { href: "/found", label: "Found a dog?" },
      { href: "/account", label: "My dogs" },
    ],
  },
  {
    title: "Around Dunedin",
    links: [
      { href: "/things-to-do", label: "Local guide" },
      { href: "/list-your-business", label: "List your business" },
      { href: "/events", label: "Events", soon: "events" },
      // The Club is pre-launch: the link stays (clicks are tracked as
      // interest) but the member-card link is hidden until there are members.
      { href: "/membership", label: "Dogedin Club", soon: "club" },
    ],
  },
  {
    title: "Shop & Support",
    links: [
      { href: "/shop", label: "The Shop" },
      { href: "/advertise", label: "Advertise with Dogedin" },
    ],
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <CartProvider>
          {/* Scottish tartan ribbon */}
          <div className="tartan h-2.5" />

          {/* Marquee announcement bar */}
          <div className="overflow-hidden border-y-[3px] border-black bg-[var(--navy)] py-2 text-[var(--sand)]">
            <div className="animate-marquee flex w-max gap-10 whitespace-nowrap text-sm font-extrabold uppercase tracking-wide">
              {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>

          {/* Header */}
          <header className="sticky top-0 z-30 border-b-[3px] border-black bg-[var(--sand)]">
            <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <a
                href="/"
                className="font-display text-2xl font-bold tracking-tight"
              >
                <span className="inline-block -rotate-2 border-[3px] border-black bg-[var(--gold)] px-3 py-1 shadow-hard">
                  🐾 Dogedin
                </span>
              </a>
              <SiteNav />
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

          {/* Gulf-coast footer */}
          <footer className="mt-16">
            <div className="scallop" />
            <div className="border-t-[3px] border-black bg-[var(--turq)]">
              <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-8 sm:grid-cols-3">
                {FOOTER_COLS.map((col) => (
                  <nav key={col.title} aria-label={col.title}>
                    <h3 className="font-display text-lg font-extrabold text-[var(--sand)]">
                      {col.title}
                    </h3>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {col.links.map((l) => (
                        <li key={l.href}>
                          {l.soon ? (
                            <ComingSoonLink
                              feature={l.soon}
                              source="footer"
                              href={l.href}
                              className="text-sm font-bold text-[var(--sand)]/85 hover:text-[var(--sand)] hover:underline"
                            >
                              {l.label}
                            </ComingSoonLink>
                          ) : (
                            <a
                              href={l.href}
                              className="text-sm font-bold text-[var(--sand)]/85 hover:text-[var(--sand)] hover:underline"
                            >
                              {l.label}
                            </a>
                          )}
                        </li>
                      ))}
                      {col.title === "Shop & Support" &&
                        process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE && (
                          <li>
                            <a
                              href={`https://instagram.com/${process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-bold text-[var(--sand)]/85 hover:text-[var(--sand)] hover:underline"
                            >
                              Instagram
                            </a>
                          </li>
                        )}
                    </ul>
                  </nav>
                ))}
              </div>
              <div className="border-t-2 border-[var(--sand)]/25 py-6 text-center">
                <p className="font-display text-2xl font-bold text-[var(--sand)]">
                  By Dunedin dog people, for extremely good dogs 🐕
                </p>
                <p className="mt-1 text-sm font-bold uppercase tracking-widest text-[var(--sand)]/80">
                  Dunedin, FL 🌴
                </p>
              </div>
            </div>
          </footer>

          <CartDrawer />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
