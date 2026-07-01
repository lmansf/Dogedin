import type { Metadata } from "next";
import RegisterFlow from "@/components/dogs/RegisterFlow";

export const metadata: Metadata = {
  title: "Register your dog · Dogedin",
  description:
    "Create a dog profile with a public page and a lost-dog contact option — part of the Dogedin community.",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="relative overflow-hidden border-[3px] border-black bg-[var(--gold)] p-6 shadow-hard-lg">
        <div className="dots pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="inline-block -rotate-2 border-[3px] border-black bg-[var(--sand)] px-3 py-1 text-xs font-black uppercase tracking-widest shadow-hard">
            🐾 Community
          </span>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-[0.95] md:text-5xl">
            Register your dog
          </h1>
          <p className="mt-3 max-w-lg font-bold text-[var(--ink)]/70">
            Give your good dog a profile page. Turn on “lost dog contact” and a
            finder can reach you if they ever wander off.
          </p>
        </div>
      </section>

      <RegisterFlow />
    </div>
  );
}
