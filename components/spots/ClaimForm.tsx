"use client";

import { useState, useTransition } from "react";
import { submitClaim } from "@/lib/businesses";

// "Claim this business" form, shown inline on a BusinessCard. Captures just
// enough to follow up (name, role, phone, email) — no account required. The
// lead lands in business_claims for an admin to verify; on verification the
// listing is linked to this email and the claimant gets portal access
// (insights + the pitch to advertise). Same table the shop's admin desk reads.
export default function ClaimForm({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const [contactName, setContactName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <div className="border-[3px] border-black bg-[var(--green)] p-4 text-sm shadow-hard">
        <p className="font-display text-lg font-extrabold text-[var(--sand)]">
          Claim received — thanks! 🐾
        </p>
        <p className="mt-1 font-bold text-[var(--sand)]/90">
          We&apos;ll verify {businessName} is really yours (a quick call or
          in-person hello) and connect it to {email}. Create your account with
          that email so you&apos;re ready to see your listing&apos;s insights.
        </p>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!contactName.trim() || !phone.trim() || !email.trim()) {
      return setError("Your name, phone and email are required.");
    }
    startTransition(async () => {
      const res = await submitClaim({
        businessId,
        businessName,
        contactName,
        email,
        phone,
        role,
        message,
      });
      if (res.error) return setError(res.error);
      setSent(true);
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-[3px] border-black bg-white p-4 shadow-hard"
    >
      <div>
        <h4 className="font-display text-lg font-extrabold">
          Own {businessName}?
        </h4>
        <p className="text-xs font-bold text-black/60">
          Claim it to see who&apos;s finding you and promote your spot. We
          verify every claim before granting access.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Your name"
          maxLength={80}
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Your role (owner, manager…)"
          maxLength={80}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          type="tel"
          placeholder="Phone"
          maxLength={40}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          maxLength={120}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <textarea
        className={`${inputClass} resize-y`}
        rows={2}
        maxLength={2000}
        placeholder="Anything to add? (best time to reach you, etc.)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <p className="text-[11px] font-semibold text-black/40">
        Use the email you&apos;ll sign in with — that&apos;s the one we link to
        your listing once you&apos;re verified.
      </p>

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit claim"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";
