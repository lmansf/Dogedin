import type { Metadata } from "next";
import ResetPasswordFlow from "@/components/dogs/ResetPasswordFlow";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Choose a new password for your Dogedin account.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">Account recovery</h1>
      <ResetPasswordFlow />
    </div>
  );
}
