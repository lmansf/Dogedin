"use client";

import { useState } from "react";
import { recordFeatureClick } from "@/lib/featureInterest";

// The one interactive element on a "coming soon" page: a button that counts a
// paw of interest and thanks the clicker. Deliberately collects nothing — no
// email, no account — and promises nothing in return.
export default function InterestButton({ feature }: { feature: string }) {
  const [clicked, setClicked] = useState(false);

  if (clicked) {
    return (
      <p className="border-[3px] border-black bg-[var(--green)] px-5 py-3 text-center text-base font-black uppercase tracking-wide text-[var(--sand)] shadow-hard">
        Noted — thanks! 🐾
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        recordFeatureClick(feature, "interest_button");
        setClicked(true);
      }}
      className="w-full border-[3px] border-black bg-[var(--turq)] px-5 py-3 text-base font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
    >
      🐾 I&apos;d be interested
    </button>
  );
}
