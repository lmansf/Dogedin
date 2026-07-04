"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DOG_PHOTO_BUCKET } from "@/lib/dogProfiles";
import { useSupabaseUser, AuthPanel, signOut } from "./auth";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3 MB
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Turn a dog name into a URL-safe slug stem. A short random suffix is appended
// at insert time so two "Rex"es don't collide.
function slugStem(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "dog"
  );
}

function randomSuffix(): string {
  // 6 hex chars from a random UUID — plenty for collision avoidance here.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

// Short human-readable code for a physical tag / QR. Avoids ambiguous
// characters (0/O, 1/I) so it's easy to read off a tag and type into /found.
function randomTagCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export default function RegisterFlow() {
  const router = useRouter();
  const { user, loading, configured } = useSupabaseUser();

  if (loading) {
    return <p className="text-sm font-bold text-black/50">Loading…</p>;
  }
  if (!configured) {
    return <AuthPanel />;
  }
  if (!user) {
    return (
      <AuthPanel intro="Sign in or create an account to register your dog. This keeps each profile tied to you so only you can edit it." />
    );
  }
  return (
    <RegistrationForm
      userId={user.id}
      defaultEmail={user.email ?? ""}
      // welcome=1 → the profile page greets the new owner with next steps
      // (get the tag & QR, see events) instead of dead-ending.
      onDone={(slug) => router.push(`/dog/${slug}?welcome=1`)}
    />
  );
}

function RegistrationForm({
  userId,
  defaultEmail,
  onDone,
}: {
  userId: string;
  defaultEmail: string;
  onDone: (slug: string) => void;
}) {
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(defaultEmail);
  const [dogName, setDogName] = useState("");
  const [breed, setBreed] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [lostOptIn, setLostOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const pickPhoto = (file: File | null) => {
    setError(null);
    if (!file) return setPhoto(null);
    if (!PHOTO_TYPES.includes(file.type))
      return setError("Photo must be a JPG, PNG or WEBP.");
    if (file.size > MAX_PHOTO_BYTES)
      return setError("Photo must be 3 MB or smaller.");
    setPhoto(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const client = supabase;
    if (!client) return setError("Supabase isn't configured.");
    if (!ownerName.trim() || !ownerPhone.trim() || !ownerEmail.trim() || !dogName.trim())
      return setError("Owner name, phone, email and dog name are all required.");

    startTransition(async () => {
      // 1. Upload the photo (optional) into the owner's folder.
      let photoPath: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        photoPath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await client.storage
          .from(DOG_PHOTO_BUCKET)
          .upload(photoPath, photo, { contentType: photo.type, upsert: false });
        if (upErr) return setError(`Photo upload failed: ${upErr.message}`);
      }

      // 2. Run the fun fact through the moderation/cleanup Edge Function: it
      // fixes spelling, trims rambles, and rejects anything inappropriate
      // (cleaned: null) since this text shows publicly and feeds Instagram
      // captions. If the function isn't deployed yet, fall back to the raw
      // (length-capped) text so registration never blocks on it.
      let cleanBio: string | null = bio.trim().slice(0, 300) || null;
      if (cleanBio) {
        try {
          const { data, error: modErr } = await client.functions.invoke(
            "moderate-bio",
            { body: { text: cleanBio } }
          );
          if (!modErr && data && "cleaned" in data) {
            cleanBio = data.cleaned;
          }
        } catch {
          // moderation unavailable — keep the raw text
        }
      }

      // 3. Insert the profile, retrying on the (rare) slug collision.
      const stem = slugStem(dogName);
      const base = {
        user_id: userId,
        owner_name: ownerName.trim(),
        owner_phone: ownerPhone.trim(),
        owner_email: ownerEmail.trim(),
        dog_name: dogName.trim(),
        breed: breed.trim() || null,
        bio: cleanBio,
        photo_path: photoPath,
        lost_contact_opt_in: lostOptIn,
      };

      // Remove the just-uploaded photo if the profile never gets created, so a
      // failed registration doesn't leave an orphaned object in storage.
      const cleanupPhoto = async () => {
        if (photoPath)
          await client.storage.from(DOG_PHOTO_BUCKET).remove([photoPath]);
      };

      for (let attempt = 0; attempt < 4; attempt++) {
        const slug = `${stem}-${randomSuffix()}`;
        const { error: insErr } = await client
          .from("dog_profiles")
          .insert({ ...base, slug, tag_code: randomTagCode() });
        if (!insErr) return onDone(slug);
        if (insErr.code !== "23505") {
          await cleanupPhoto();
          return setError(`Couldn't save the profile: ${insErr.message}`);
        }
        // 23505 = unique violation on slug or tag_code → try fresh codes.
      }
      await cleanupPhoto();
      setError("Couldn't generate a unique profile link — please try again.");
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 border-[3px] border-black bg-white p-5 shadow-hard sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">Register your dog</h2>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs font-bold uppercase tracking-wide text-black/50 hover:underline"
        >
          Sign out
        </button>
      </div>

      <Field label="Your name" required>
        <input
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className={inputClass}
          maxLength={80}
          required
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Phone" required>
          <input
            type="tel"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            className={inputClass}
            maxLength={40}
            required
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className={inputClass}
            maxLength={120}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Dog's name" required>
          <input
            type="text"
            value={dogName}
            onChange={(e) => setDogName(e.target.value)}
            className={inputClass}
            maxLength={60}
            required
          />
        </Field>
        <Field label="Breed">
          <input
            type="text"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className={inputClass}
            maxLength={60}
            placeholder="e.g. Border Collie"
          />
        </Field>
      </div>

      <Field label="Fun fact">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="e.g. Has personally greeted every dog on the Pinellas Trail"
          className={`${inputClass} resize-y`}
        />
        <span className="text-[11px] font-semibold text-black/40">
          Shows on {dogName ? `${dogName}'s` : "your dog's"} page — and gives
          our dog-of-the-day Instagram post something to brag about.
        </span>
      </Field>

      <Field label="Photo">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden border-2 border-black bg-zinc-100">
            {preview ? (
              // Local object URL preview — plain img is correct here (not a
              // remote/optimizable source).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-3xl">🐶</span>
            )}
          </div>
          <input
            type="file"
            accept={PHOTO_TYPES.join(",")}
            onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
      </Field>

      <label className="flex items-start gap-3 border-2 border-black bg-[var(--sand)] p-3">
        <input
          type="checkbox"
          checked={lostOptIn}
          onChange={(e) => setLostOptIn(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--turq)]"
        />
        <span className="text-sm">
          <span className="font-extrabold">Lost dog contact</span> — show my phone
          &amp; email on {dogName ? `${dogName}'s` : "my dog's"} public profile so a
          finder can reach me. Leave off to keep contact details private.
        </span>
      </label>

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit border-[3px] border-black bg-[var(--turq)] px-5 py-2.5 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-50"
      >
        {pending ? "Saving…" : "Create profile"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold uppercase tracking-wide text-black/60">
        {label}
        {required && <span className="text-[var(--red)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
