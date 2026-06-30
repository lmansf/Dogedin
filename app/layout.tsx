import type { Metadata } from "next";
import { Bricolage_Grotesque, Nunito } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";
import CartDrawer from "@/components/cart/CartDrawer";
import CartButton from "@/components/cart/CartButton";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const body = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Dogedin - good gear for good dogs",
  description: "An eccentric little shop for extremely good dogs.",
};

const MARQUEE = [
  "🐾 FREE TREATS ON ORDERS OVER $50",
  "🦴 NEW DROPS EVERY WEEK",
  "🐶 GOOD DOGS ONLY",
  "📦 SHIPS IN A WAG",
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
          {/* Marquee announcement bar */}
          <div className="overflow-hidden border-b-[3px] border-black bg-[var(--grape)] py-2 text-white">
            <div className="animate-marquee flex w-max gap-8 whitespace-nowrap text-sm font-extrabold uppercase tracking-wide">
              {[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>

          {/* Header */}
          <header className="sticky top-0 z-30 border-b-[3px] border-black bg-[var(--cream)]">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <a
                href="/"
                className="font-display text-2xl font-extrabold tracking-tight"
              >
                <span className="inline-block -rotate-3 border-[3px] border-black bg-[var(--amber)] px-3 py-1 shadow-hard">
                  🐾 Dogedin
                </span>
              </a>
              <nav className="flex items-center gap-3 text-sm font-extrabold uppercase">
                <a href="/" className="hidden hover:underline sm:inline">
                  Shop
                </a>
                <a
                  href="/mockup"
                  className="hidden -rotate-2 border-[3px] border-black bg-[var(--pink)] px-3 py-1 text-white shadow-hard hover:-translate-y-0.5 sm:inline-block"
                >
                  Mockup
                </a>
                <CartButton />
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

          {/* Footer ribbon (no copyright) */}
          <footer className="mt-16 border-t-[3px] border-black bg-[var(--sky)] py-8 text-center">
            <p className="font-display text-2xl font-extrabold text-white">
              Built for extremely good dogs 🐕
            </p>
          </footer>

          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
