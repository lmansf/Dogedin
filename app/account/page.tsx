import type { Metadata } from "next";
import Link from "next/link";
import AccountDogs from "@/components/dogs/AccountDogs";

export const metadata: Metadata = {
  title: "My dogs",
};

export default function AccountPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">My dogs</h1>
        <Link
          href="/register"
          className="border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
        >
          + Register
        </Link>
      </div>
      <AccountDogs />
    </div>
  );
}
