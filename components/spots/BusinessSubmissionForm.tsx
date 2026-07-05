"use client";

import { useState, useTransition } from "react";
import {
  BUSINESS_CATEGORIES,
  DAYS_OF_WEEK,
  EMPTY_HOURS,
  submitBusiness,
  validateBusinessPhoto,
  type BusinessHours,
} from "@/lib/businesses";
import { supabase } from "@/lib/supabase";
import PhotoPicker from "@/components/PhotoPicker";

const DAY_LABELS: Record<(typeof DAYS_OF_WEEK)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export default function BusinessSubmissionForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(BUSINESS_CATEGORIES[0]);
  const [neighborhood, setNeighborhood] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [dogFriendly, setDogFriendly] = useState(true);
  const [hours, setHours] = useState<BusinessHours>(EMPTY_HOURS);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const pickPhoto = (file: File | null) => {
    setError(null);
    if (!file) return setPhoto(null);
    const bad = validateBusinessPhoto(file);
    if (bad) return setError(bad);
    setPhoto(file);
  };

  const setDay = (day: keyof BusinessHours, patch: Partial<BusinessHours[keyof BusinessHours]>) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  if (!supabase) {
    return (
      <p className="border-[3px] border-black bg-[var(--gold)]/30 px-4 py-3 text-sm font-bold">
        This form isn&apos;t connected yet — set the Supabase env vars and run{" "}
        <code className="border border-black bg-white px-1">supabase/schema.sql</code>.
      </p>
    );
  }

  if (sent) {
    return (
      <div className="border-[3px] border-black bg-[var(--green)] p-6 text-center shadow-hard">
        <p className="font-display text-xl font-extrabold text-[var(--sand)]">
          Thanks — we&apos;ll take a look! 🐾
        </p>
        <p className="mt-2 text-sm font-bold text-[var(--sand)]">
          📬 Check your email for a link to your personalized business
          dashboard!
        </p>
        <p className="mt-1 text-sm font-bold text-[var(--sand)]/90">
          Or head straight to{" "}
          <a href="/portal" className="underline">
            your dashboard
          </a>{" "}
          — sign in with the email you just gave us (same login as dogedin.com;
          create the account if you don&apos;t have one yet). A Dogedin admin
          reviews every submission before it goes live in the guide.
        </p>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const client = supabase;
    if (!client) return;
    if (
      !name.trim() ||
      !description.trim() ||
      !address.trim() ||
      !ownerName.trim() ||
      !ownerEmail.trim()
    ) {
      return setError("Business name, description, address, your name and email are all required.");
    }
    if (!photo) return setError("A photo for the card is required.");

    startTransition(async () => {
      const { error, businessId } = await submitBusiness({
        name,
        category,
        neighborhood,
        description,
        address,
        phone,
        website,
        dogFriendly,
        hours,
        ownerName,
        ownerEmail,
        photo,
      });
      if (error) return setError(error);
      setSent(true);
      // Best-effort welcome email with their portal link — the listing is
      // already safely stored either way (one-shot via welcome_sent_at).
      if (businessId) {
        client.functions
          .invoke("welcome-business", { body: { business_id: businessId } })
          .catch(() => {});
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 border-[3px] border-black bg-white p-5 shadow-hard sm:p-6"
    >
      <h2 className="font-display text-2xl font-extrabold">List your business</h2>
      <p className="text-sm text-black/60">
        Every submission is reviewed before it appears on{" "}
        <span className="font-bold">Things to do in Dunedin</span> — fill in as
        much as you can so visitors can find you and know when to stop by.
      </p>

      <Field label="Business name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className={inputClass}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" required>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Neighborhood">
          <input
            type="text"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            maxLength={80}
            placeholder="e.g. Downtown Dunedin"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description" required>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="What makes it worth a visit — and how it treats dogs."
          className={`${inputClass} resize-y`}
          required
        />
      </Field>

      <Field
        label="Street address"
        required
        hint="Used to build one-tap Google Maps / Apple Maps directions links."
      >
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={200}
          placeholder="123 Main St, Dunedin, FL 34698"
          className={inputClass}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            placeholder="(727) 555-0100"
            className={inputClass}
          />
        </Field>
        <Field label="Website">
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={200}
            placeholder="https://…"
            className={inputClass}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 border-2 border-black bg-[var(--sand)] p-3">
        <input
          type="checkbox"
          checked={dogFriendly}
          onChange={(e) => setDogFriendly(e.target.checked)}
          className="h-5 w-5 shrink-0 accent-[var(--turq)]"
        />
        <span className="text-sm font-bold">Dogs are welcome here</span>
      </label>

      <fieldset className="flex flex-col gap-2 border-2 border-black p-3">
        <legend className="px-1 text-xs font-extrabold uppercase tracking-wide text-black/60">
          Hours — every day, please
        </legend>
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <span className="w-24 shrink-0 text-sm font-bold">{DAY_LABELS[day]}</span>
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-black/60">
              <input
                type="checkbox"
                checked={hours[day].closed}
                onChange={(e) => setDay(day, { closed: e.target.checked })}
                className="h-4 w-4 accent-[var(--coral)]"
              />
              Closed
            </label>
            {!hours[day].closed && (
              <>
                <input
                  type="time"
                  value={hours[day].open ?? ""}
                  onChange={(e) => setDay(day, { open: e.target.value })}
                  className="border-2 border-black bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
                />
                <span className="text-xs font-bold text-black/40">to</span>
                <input
                  type="time"
                  value={hours[day].close ?? ""}
                  onChange={(e) => setDay(day, { close: e.target.value })}
                  className="border-2 border-black bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]"
                />
              </>
            )}
          </div>
        ))}
      </fieldset>

      {/* A div, not <Field> — PhotoPicker has its own <label> inside, and
          labels can't nest. Same visual structure as Field. */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wide text-black/60">
          Photo for your card<span className="text-[var(--red)]"> *</span>
        </span>
        <PhotoPicker
          file={photo}
          onPick={pickPhoto}
          accept="image/jpeg,image/png,image/webp"
          emptyIcon="🏪"
          previewClassName="h-20 w-28"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 border-t-2 border-black/10 pt-4 sm:grid-cols-2">
        <Field label="Your name" required hint="Not shown publicly — for our follow-up only.">
          <input
            type="text"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            maxLength={80}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Your email" required hint="Not shown publicly — for our follow-up only.">
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            maxLength={120}
            className={inputClass}
            required
          />
        </Field>
      </div>

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit border-[3px] border-black bg-[var(--turq)] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold uppercase tracking-wide text-black/60">
        {label}
        {required && <span className="text-[var(--red)]"> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] font-semibold text-black/40">{hint}</span>}
    </label>
  );
}
