import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import CartDrawer from "@/components/cart/CartDrawer";
import SiteNav from "@/components/SiteNav";

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
  title: "Dogedin - good gear for good dogs · Dunedin, FL",
  description:
    "An eccentric little shop for extremely good dogs. Scotland of the Sunshine State, by way of the Gulf coast.",
};

const MARQUEE = [
  "🏴 SCOTLAND OF THE SUNSHINE STATE",
  "🦴 FREE TREATS OVER $50",
  "🌊 SHIPS FROM THE GULF COAST",
  "🍺 GOOD DOGS · GOOD BREWS",
  "🐾 HIGHLAND GOOD BOYS WELCOME",
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
            <div className="border-t-[3px] border-black bg-[var(--turq)] py-8 text-center">
              <p className="font-display text-2xl font-bold text-[var(--sand)]">
                Built for extremely good dogs 🐕
              </p>
              <p className="mt-1 text-sm font-bold uppercase tracking-widest text-[var(--sand)]/80">
                Scotland of the Sunshine State 🏴 · Dunedin, FL 🌴
              </p>
            </div>
          </footer>

          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
