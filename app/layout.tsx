import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dogedin",
  description: "Good gear for good dogs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-black/10 dark:border-white/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <a href="/" className="text-xl font-bold tracking-tight">
              🐾 Dogedin
            </a>
            <nav className="flex gap-6 text-sm text-zinc-500">
              <a href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Shop
              </a>
              <a href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Cart
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-zinc-400">
          © {new Date().getFullYear()} Dogedin
        </footer>
      </body>
    </html>
  );
}
