"use client";

import { useState, useTransition } from "react";
import { supabase } from "@/lib/supabase";
import PhotoPicker from "@/components/PhotoPicker";
import {
  AD_CREATIVE_BUCKET,
  AD_CREATIVE_TYPES,
  AD_SPECS,
  validateAdCreative,
  type AdPlacement,
} from "@/lib/ads";

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

  // Optional ad application (creative + placement + destination).
  const [placement, setPlacement] = useState<AdPlacement>("banner");
  const [creative, setCreative] = useState<File | null>(null);
  const [mobileCreative, setMobileCreative] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [creativeError, setCreativeError] = useState<string | null>(null);

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
          {creative
            ? "Your ad is in the queue for review — we'll confirm placement and payment before it goes live."
            : "Thanks for supporting Dunedin's dog community."}
        </p>
      </div>
    );
  }

  const spec = AD_SPECS[placement];

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
    if (creative && !/^https?:\/\//i.test(linkUrl.trim()))
      return setError(
        "Add the destination link (https://…) your ad should click through to."
      );

    startTransition(async () => {
      // 1. Store the lead first — it's the thing we must never lose, and the
      // notify function keys off this row. Id is minted client-side because
      // anon can't read the row back to get a returned id.
      const inquiryId = crypto.randomUUID();
      const { error: inqErr } = await client.from("ad_inquiries").insert({
        id: inquiryId,
        business_name: businessName.trim().slice(0, 120),
        contact_name: contactName.trim().slice(0, 80),
        email: email.trim().slice(0, 120),
        message: message.trim().slice(0, 2000) || null,
      });
      if (inqErr) return setError("Couldn't send that — please try again.");

      // 2. If a creative was attached, upload it and create an applied ad.
      if (creative) {
        const upload = async (file: File): Promise<string | null> => {
          const ext = file.name.split(".").pop()?.toLowerCase() || "png";
          const path = `${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await client.storage
            .from(AD_CREATIVE_BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) return null;
          return client.storage.from(AD_CREATIVE_BUCKET).getPublicUrl(path).data
            .publicUrl;
        };

        const imageUrl = await upload(creative);
        if (!imageUrl) {
          // The lead is safely stored; just tell them the image part failed.
          return setError(
            "Your message was sent, but the creative upload failed — please email it to us."
          );
        }
        const mobileUrl = mobileCreative ? await upload(mobileCreative) : null;

        // status is forced to 'applied' by RLS; set it explicitly so intent is
        // clear. active:false so nothing renders until an admin activates it.
        const { error: adErr } = await client.from("advertisers").insert({
          business_name: businessName.trim().slice(0, 120),
          image_url: imageUrl,
          mobile_image_url: mobileUrl,
          link_url: linkUrl.trim(),
          placement,
          status: "applied",
          active: false,
          weight: 1,
          contact_email: email.trim().slice(0, 120),
        });
        if (adErr)
          return setError(
            "Your message was sent, but we couldn't file the ad — we'll follow up by email."
          );
      }

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

      {/* Optional: apply with a ready creative so it lands straight in the ad
          console. Fully skippable — leave it blank to just say hello. */}
      <fieldset className="flex flex-col gap-3 border-2 border-dashed border-black/30 p-3">
        <legend className="px-1 text-xs font-black uppercase tracking-wide text-black/60">
          Have your ad ready? (optional)
        </legend>

        <label className="flex flex-col gap-1 text-xs font-extrabold uppercase tracking-wide text-black/60">
          Placement
          <select
            className={input}
            value={placement}
            onChange={(e) => changePlacement(e.target.value as AdPlacement)}
          >
            {(Object.keys(AD_SPECS) as AdPlacement[]).map((p) => (
              <option key={p} value={p}>
                {AD_SPECS[p].label} — {AD_SPECS[p].blurb}
              </option>
            ))}
          </select>
        </label>

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

        {creativeError && (
          <p className="text-sm font-bold text-[var(--red)]">{creativeError}</p>
        )}
      </fieldset>

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-fit border-[3px] border-black bg-[var(--turq)] px-5 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending ? "Sending…" : creative ? "Submit ad application" : "Send inquiry"}
      </button>
    </form>
  );
}

const input =
  "border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";
