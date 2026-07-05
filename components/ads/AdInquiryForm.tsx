"use client";

import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import PhotoPicker from "@/components/PhotoPicker";
import {
  AD_CREATIVE_BUCKET,
  AD_CREATIVE_TYPES,
  AD_LOCATIONS,
  AD_SPECS,
  adDailyCents,
  adRunDays,
  adTotalCents,
  formatUsd,
  validateAdCreative,
  type AdPlacement,
} from "@/lib/ads";
import { submitPaidAd } from "@/app/advertise/actions";

// Inquiry + ad application form for local businesses who want a slot. Always
// writes a lead to ad_inquiries (anyone may insert; only admins read). If the
// business also attaches a spec-conforming creative + destination link, we
// upload the creative and create an `applied` advertiser row so it shows up in
// the ad console for an admin to approve, pay-attest, and activate — no code
// change to run a campaign. When Supabase isn't configured we say so rather
// than silently dropping the message.
export default function AdInquiryForm() {
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  // Optional ad application (creative + placement + destination + flight dates).
  const [placement, setPlacement] = useState<AdPlacement>("banner");
  const [creative, setCreative] = useState<File | null>(null);
  const [mobileCreative, setMobileCreative] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [creativeError, setCreativeError] = useState<string | null>(null);

  // Which path the business is on: "instant" = upload a banner, pay, and go
  // live automatically (skips approval); "inquiry" = send a note for a human to
  // review and follow up. Chosen via the two tiles at the top of the form.
  const [mode, setMode] = useState<"instant" | "inquiry">("instant");
  const [sent, setSent] = useState(false);
  const [queued, setQueued] = useState(false); // paid path fell back to manual review
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
          {queued
            ? "We couldn't auto-review your ad just now, so a human will check it and email you a secure payment link. You weren't charged."
            : "Thanks for supporting Dunedin's dog community."}
        </p>
      </div>
    );
  }

  const spec = AD_SPECS[placement];
  const runDays = adRunDays(startsAt, endsAt);
  const estimateCents = adTotalCents(placement, runDays);

  // Validate a picked creative against the selected placement's spec, keeping
  // the file only if it conforms so we never upload something off-spec.
  const pickCreative = async (
    file: File | null,
    variant: "primary" | "mobile"
  ) => {
    setCreativeError(null);
    const set = variant === "mobile" ? setMobileCreative : setCreative;
    if (!file) return set(null);
    const err = await validateAdCreative(file, placement, variant);
    if (err) {
      set(null);
      return setCreativeError(err);
    }
    set(file);
  };

  // Re-check any already-picked files when the placement changes (a 728×90
  // banner creative isn't valid for a 300×250 generic slot).
  const changePlacement = (p: AdPlacement) => {
    setPlacement(p);
    setCreative(null);
    setMobileCreative(null);
    setCreativeError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const client = supabase;
    if (!client) return;
    if (!businessName.trim() || !contactName.trim() || !email.trim())
      return setError("Business, contact name and email are required.");
    // ---- Instant self-serve path: upload the banner, hand off to the server
    // which moderates it and (if clean) returns a Stripe Checkout link. Paying
    // makes it live automatically — no admin approval. ----
    if (mode === "instant") {
      if (!creative)
        return setError(
          "Upload your banner to advertise now — or switch to “Send an inquiry” above."
        );
      if (!/^https?:\/\/\S+/i.test(linkUrl.trim()))
        return setError(
          "Add the destination link (https://…) your ad should click through to."
        );
      if (!startsAt || !endsAt || runDays < 1)
        return setError(
          "Pick the dates your ad should run (end on or after the start)."
        );

      startTransition(async () => {
        const upload = async (
          file: File
        ): Promise<{ path: string; url: string } | null> => {
          const ext = file.name.split(".").pop()?.toLowerCase() || "png";
          const path = `${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await client.storage
            .from(AD_CREATIVE_BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) return null;
          const url = client.storage
            .from(AD_CREATIVE_BUCKET)
            .getPublicUrl(path).data.publicUrl;
          return { path, url };
        };

        try {
          const primary = await upload(creative);
          if (!primary)
            return setError("The creative upload failed — please try again.");
          const mobile = mobileCreative ? await upload(mobileCreative) : null;

          const res = await submitPaidAd({
            businessName,
            contactName,
            email,
            placement,
            linkUrl,
            startsAt,
            endsAt,
            imagePath: primary.path,
            imageUrl: primary.url,
            mobileImagePath: mobile?.path ?? null,
            mobileImageUrl: mobile?.url ?? null,
          });

          if ("url" in res) {
            window.location.href = res.url; // to Stripe Checkout
            return;
          }
          if ("rejected" in res)
            return setError(
              "Your creative wasn't approved for our family-friendly guidelines. Adjust it and try again — you weren't charged."
            );
          if ("queued" in res) {
            setQueued(true);
            setSent(true);
            return;
          }
          return setError(res.error);
        } catch (err) {
          // A thrown server action would otherwise crash the whole page to
          // "a client-side exception"; surface it as a message + log the real
          // error so it's visible in the console instead.
          console.error("Paid-ad submission failed:", err);
          setError(
            "Something went wrong setting up your payment — please try again, or use “Send an inquiry” above."
          );
        }
      });
      return;
    }

    // ---- Just saying hello (no creative): store a lead for the team. ----
    startTransition(async () => {
      // Id is minted client-side because anon can't read the row back for one.
      const inquiryId = crypto.randomUUID();
      const { error: inqErr } = await client.from("ad_inquiries").insert({
        id: inquiryId,
        business_name: businessName.trim().slice(0, 120),
        contact_name: contactName.trim().slice(0, 80),
        email: email.trim().slice(0, 120),
        message: message.trim().slice(0, 2000) || null,
      });
      if (inqErr) return setError("Couldn't send that — please try again.");
      setSent(true);
      // Best-effort email nudge to the team — the lead is already stored.
      client.functions
        .invoke("notify-ad-inquiry", { body: { inquiry_id: inquiryId } })
        .catch(() => {});
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-[3px] border-black bg-white p-5 shadow-hard"
    >
      <div>
        <h2 className="font-display text-xl font-extrabold">Advertise with us</h2>
        <p className="mt-1 text-sm font-bold text-black/60">
          Two ways to run your ad — pick one:
        </p>
      </div>

      {/* Path chooser. The whole point: a ready banner skips approval entirely
          and goes live on payment; otherwise a person reviews an inquiry. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("instant")}
          aria-pressed={mode === "instant"}
          className={`flex flex-col gap-1 border-[3px] border-black p-3 text-left shadow-hard transition-transform hover:-translate-y-0.5 ${
            mode === "instant" ? "bg-[var(--green)]" : "bg-white"
          }`}
        >
          <span
            className={`text-sm font-black uppercase tracking-wide ${
              mode === "instant" ? "text-[var(--sand)]" : ""
            }`}
          >
            ⚡ I&apos;m ready to advertise now
          </span>
          <span
            className={`text-xs font-bold ${
              mode === "instant" ? "text-[var(--sand)]/90" : "text-black/60"
            }`}
          >
            Upload your finished banner, pick your dates and pay. It clears an
            automatic content check and goes live right away — no approval wait.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("inquiry")}
          aria-pressed={mode === "inquiry"}
          className={`flex flex-col gap-1 border-[3px] border-black p-3 text-left shadow-hard transition-transform hover:-translate-y-0.5 ${
            mode === "inquiry" ? "bg-[var(--turq)]" : "bg-white"
          }`}
        >
          <span
            className={`text-sm font-black uppercase tracking-wide ${
              mode === "inquiry" ? "text-[var(--sand)]" : ""
            }`}
          >
            💬 Send an inquiry
          </span>
          <span
            className={`text-xs font-bold ${
              mode === "inquiry" ? "text-[var(--sand)]/90" : "text-black/60"
            }`}
          >
            No artwork yet, or want to ask first? Send a note — a real person
            reviews it and follows up with next steps.
          </span>
        </button>
      </div>

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
      {mode === "inquiry" && (
        <textarea
          className={`${input} resize-y`}
          rows={3}
          maxLength={2000}
          placeholder="Anything we should know? (which slot, when, what you'd like to promote)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      )}

      {/* The instant self-serve builder: pick a spot, upload the banner, set
          dates + link, and pay — moderated automatically, live on payment. */}
      {mode === "instant" && (
      <fieldset className="flex flex-col gap-3 border-2 border-dashed border-[var(--green)]/60 bg-[var(--green)]/5 p-3">
        <legend className="px-1 text-xs font-black uppercase tracking-wide text-[var(--green)]">
          ⚡ Set up your ad
        </legend>

        <label className="flex flex-col gap-1 text-xs font-extrabold uppercase tracking-wide text-black/60">
          Which spot?
          <select
            className={input}
            value={placement}
            onChange={(e) => changePlacement(e.target.value as AdPlacement)}
          >
            {AD_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.placement}>
                {loc.name} — {loc.where}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm font-black">
          {formatUsd(adDailyCents(placement))}
          <span className="text-xs font-bold">/day</span>
          <span className="ml-1.5 text-xs font-bold text-black/50">
            — pay only for the days you run
          </span>
        </p>

        <p className="text-xs font-bold text-black/50">
          Required spec: <strong>{spec.width}×{spec.height} px</strong>, JPG/PNG/WebP,
          ≤{Math.round(spec.maxBytes / 1024)} KB.
          {spec.mobile && (
            <>
              {" "}
              Optional mobile variant: {spec.mobile.width}×{spec.mobile.height} px.
            </>
          )}
        </p>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wide text-black/60">
            Creative ({spec.width}×{spec.height})
          </span>
          <PhotoPicker
            file={creative}
            onPick={(f) => pickCreative(f, "primary")}
            accept={AD_CREATIVE_TYPES.join(",")}
            emptyIcon="🖼️"
          />
        </div>

        {spec.mobile && creative && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wide text-black/60">
              Mobile variant ({spec.mobile.width}×{spec.mobile.height}) — optional
            </span>
            <PhotoPicker
              file={mobileCreative}
              onPick={(f) => pickCreative(f, "mobile")}
              accept={AD_CREATIVE_TYPES.join(",")}
              emptyIcon="📱"
            />
          </div>
        )}

        {creative && (
          <input
            className={input}
            placeholder="Destination link for the ad (https://…)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        )}

        {creative && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-extrabold uppercase tracking-wide text-black/60">
              Runs from
              <input
                type="date"
                className={input}
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-extrabold uppercase tracking-wide text-black/60">
              Runs to
              <input
                type="date"
                className={input}
                min={startsAt || undefined}
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </label>
            <span className="text-[11px] font-bold text-black/40">
              Optional — leave blank to run until you tell us to stop.
            </span>
          </div>
        )}

        {creative && runDays > 0 && (
          <p className="border-2 border-black bg-[var(--gold)]/25 px-3 py-2 text-sm font-bold">
            {formatUsd(adDailyCents(placement))}/day × {runDays} day
            {runDays === 1 ? "" : "s"} ={" "}
            <strong className="font-black">{formatUsd(estimateCents)}</strong>
            <span className="mt-0.5 block text-[11px] font-normal text-black/50">
              Pay securely now — your ad goes live automatically as soon as the
              creative passes a quick content check.
            </span>
          </p>
        )}

        {creativeError && (
          <p className="text-sm font-bold text-[var(--red)]">{creativeError}</p>
        )}
      </fieldset>
      )}

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-fit border-[3px] border-black bg-[var(--turq)] px-5 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending
          ? "One sec…"
          : mode === "instant"
            ? runDays > 0
              ? `Pay & go live · ${formatUsd(estimateCents)}`
              : "Continue to payment"
            : "Send inquiry"}
      </button>
    </form>
  );
}

const input =
  "border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";
