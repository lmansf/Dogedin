import type { Metadata } from "next";
import AdminHome from "@/components/admin/AdminHome";

export const metadata: Metadata = {
  title: "Console",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="font-display text-4xl font-extrabold">Mission Control</h1>
      <p className="text-sm font-bold text-black/60">
        Everything that needs a decision, in one place.
      </p>
      <AdminHome />
    </div>
  );
}
