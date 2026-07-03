"use client";

import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";

// Inquiry form for local businesses who want an ad slot. Writes to the
// ad_inquiries table (anyone may insert; only admins can read). When Supabase
// isn't configured we say so rather than silently dropping the message.
export default function AdInquiryForm() {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!supabase) {
    return (
      <p className="border-[3px] border-black bg-[var(--gold)]/30 px-4 py-3 text-sm font-bold">
        The inquiry form isn&apos;t connected yet — stop by the shop on Main
        Street and ask for the Dogedin folks instead.
      </p>
    );
  }

  if (sent) {
    return (
      <div className="border-[3px] border-black bg-[var(--green)] p-6 text-center shadow-hard">
        <p className="font-display text-xl font-extrabold text-[var(--sand)]">
          Got it — we&apos;ll be in touch! 🐾
        </p>
        <p className="mt-1 text-sm font-bold text-[var(--sand)]/90">
          Thanks for supporting Dunedin&apos;s dog community.
        </p>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const client = supabase;
    if (!client) return;
    if (!businessName.trim() || !contactName.trim() || !email.trim())
      return setError("Business, contact name and email are required.");
    startTransition(async () => {
      // Anonymous inserts can't be read back (no anon select policy on this
      // table), so we mint the id ourselves and pass it straight to the
      // notify function rather than relying on a post-insert .select().
      const id = crypto.randomUUID();
      const { error } = await client.from("ad_inquiries").insert({
        id,
        business_name: businessName.trim().slice(0, 120),
        contact_name: contactName.trim().slice(0, 80),
        email: email.trim().slice(0, 120),
        message: message.trim().slice(0, 2000) || null,
      });
      if (error) return setError("Couldn't send that — please try again.");
      setSent(true);
      // Best-effort email nudge to the team — the inquiry is already safely
      // stored above, so a failure here shouldn't affect what the user sees.
      client.functions.invoke("notify-ad-inquiry", { body: { inquiry_id: id } }).catch(() => {});
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-[3px] border-black bg-white p-5 shadow-hard"
    >
      <h2 className="font-display text-xl font-extrabold">Get in touch</h2>
      <input
        className={input}
        placeholder="Business name"
        maxLength={120}
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          className={input}
          placeholder="Your name"
          maxLength={80}
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
        <input
          className={input}
          type="email"
          placeholder="Email"
          maxLength={120}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <textarea
        className={`${input} resize-y`}
        rows={3}
        maxLength={2000}
        placeholder="Anything we should know? (which slot, when, what you'd like to promote)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-fit border-[3px] border-black bg-[var(--turq)] px-5 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}

const input =
  "border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";
