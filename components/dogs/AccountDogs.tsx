"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { dogPhotoUrl, DOG_PHOTO_BUCKET } from "@/lib/dogProfiles";
import { useSupabaseUser, AuthPanel, signOut } from "./auth";
import TagQr from "./TagQr";

type MyDog = {
  id: string;
  slug: string;
  tag_code: string;
  dog_name: string;
  breed: string | null;
  bio: string | null;
  photo_path: string | null;
  lost_contact_opt_in: boolean;
};

// The signed-in owner's dogs. Reads are scoped to the user by RLS
// (auth.uid() = user_id), so this simple select only ever returns their rows.
export default function AccountDogs() {
  const { user, loading, configured } = useSupabaseUser();
  const [dogs, setDogs] = useState<MyDog[] | null>(null);
  const [tagOpen, setTagOpen] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("dog_profiles")
      .select("id, slug, tag_code, dog_name, breed, bio, photo_path, lost_contact_opt_in")
      .order("created_at", { ascending: false });
    setDogs((data as MyDog[]) ?? []);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const remove = async (dog: MyDog) => {
    if (!supabase) return;
    if (!confirm(`Delete ${dog.dog_name}'s profile? This can't be undone.`)) return;
    await supabase.from("dog_profiles").delete().eq("id", dog.id);
    if (dog.photo_path) {
      await supabase.storage.from(DOG_PHOTO_BUCKET).remove([dog.photo_path]);
    }
    load();
  };

  if (loading) return <p className="text-sm font-bold text-black/50">Loading…</p>;
  if (!configured || !user)
    return (
      <AuthPanel intro="Sign in to see the dogs you've registered." />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-black/60">
          Signed in as {user.email}
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-xs font-bold uppercase tracking-wide text-black/50 hover:underline"
        >
          Sign out
        </button>
      </div>

      {dogs === null ? (
        <p className="text-sm font-bold text-black/50">Loading your dogs…</p>
      ) : dogs.length === 0 ? (
        <div className="border-[3px] border-black bg-white p-5 text-sm shadow-hard">
          You haven&apos;t registered a dog yet.{" "}
          <Link href="/register" className="font-black underline">
            Register one →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {dogs.map((dog) => {
            const img = dogPhotoUrl(dog.photo_path);
            return (
              <li
                key={dog.id}
                className="border-[3px] border-black bg-white p-3 shadow-hard"
              >
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden border-2 border-black bg-zinc-100">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={dog.dog_name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-2xl">🐶</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-extrabold">{dog.dog_name}</p>
                    <p className="text-xs font-bold text-black/50">
                      {dog.breed || "Unknown breed"} ·{" "}
                      {dog.lost_contact_opt_in ? "Contact public" : "Contact private"}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setTagOpen((cur) => (cur === dog.id ? null : dog.id))
                      }
                      className="mt-1 text-xs font-black uppercase tracking-wide text-black/60 hover:underline"
                    >
                      {tagOpen === dog.id ? "Hide tag" : "Tag & QR"}
                    </button>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                    <Link
                      href={`/dog/${dog.slug}`}
                      className="border-2 border-black bg-white px-3 py-1.5 text-center text-xs font-black uppercase tracking-wide text-[var(--turq)] shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
                    >
                      View →
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setEditOpen((cur) => (cur === dog.id ? null : dog.id))
                      }
                      className="border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
                    >
                      {editOpen === dog.id ? "Close" : "Edit"}
                    </button>
                    {/* Destructive — set apart from Edit so it isn't fat-fingered. */}
                    <button
                      type="button"
                      onClick={() => remove(dog)}
                      className="mt-1.5 border-2 border-[var(--red)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--red)] transition-colors hover:bg-[var(--red)] hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editOpen === dog.id && (
                  <EditDogPanel
                    dog={dog}
                    onSaved={() => {
                      setEditOpen(null);
                      load();
                    }}
                    onCancel={() => setEditOpen(null)}
                  />
                )}

                {tagOpen === dog.id && (
                  <div className="mt-3 flex justify-center border-t-2 border-dashed border-black/20 pt-3">
                    <TagQr slug={dog.slug} tagCode={dog.tag_code} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const inputClass =
  "w-full border-2 border-black bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--turq)]";

// Inline editor for the fields an owner may change: breed, fun fact (bio) and
// the lost-dog contact toggle. Name and slug stay fixed — the slug is the
// public URL and the target printed on tag QR codes. The update goes through
// the normal client; RLS ("owners manage own dogs") scopes it to the owner.
function EditDogPanel({
  dog,
  onSaved,
  onCancel,
}: {
  dog: MyDog;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [breed, setBreed] = useState(dog.breed ?? "");
  const [bio, setBio] = useState(dog.bio ?? "");
  const [lostOptIn, setLostOptIn] = useState(dog.lost_contact_opt_in);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const client = supabase;
    if (!client) return setError("Supabase isn't configured.");
    setBusy(true);
    setError(null);

    // Re-run edited fun-fact text through the moderate-bio Edge Function —
    // same best-effort contract as registration (RegisterFlow): it cleans up
    // or rejects (cleaned: null) the text, and if the function is
    // unreachable the raw length-capped text is kept so saving never blocks.
    let cleanBio: string | null = bio.trim().slice(0, 300) || null;
    if (cleanBio && cleanBio !== dog.bio) {
      try {
        const { data, error: modErr } = await client.functions.invoke("moderate-bio", {
          body: { text: cleanBio },
        });
        if (!modErr && data && "cleaned" in data) {
          cleanBio = data.cleaned;
        }
      } catch {
        // moderation unavailable — keep the raw text
      }
    }

    const { error: upErr } = await client
      .from("dog_profiles")
      .update({
        breed: breed.trim().slice(0, 60) || null,
        bio: cleanBio,
        lost_contact_opt_in: lostOptIn,
      })
      .eq("id", dog.id);
    setBusy(false);
    if (upErr) return setError(`Couldn't save: ${upErr.message}`);
    onSaved();
  };

  return (
    <div className="mt-3 flex flex-col gap-3 border-t-2 border-dashed border-black/20 pt-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wide text-black/60">
          Breed
        </span>
        <input
          type="text"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          maxLength={60}
          placeholder="e.g. Border Collie"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wide text-black/60">
          Fun fact
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="e.g. Has personally greeted every dog on the Pinellas Trail"
          className={`${inputClass} resize-y`}
        />
      </label>

      <label className="flex items-start gap-3 border-2 border-black bg-[var(--sand)] p-3">
        <input
          type="checkbox"
          checked={lostOptIn}
          onChange={(e) => setLostOptIn(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--turq)]"
        />
        <span className="text-sm">
          <span className="font-extrabold">Lost dog contact</span> — show my
          phone &amp; email on {dog.dog_name}&apos;s public profile so a finder
          can reach me. Leave off to keep contact details private.
        </span>
      </label>

      {error && <p className="text-sm font-bold text-[var(--red)]">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="w-fit border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-xs font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-xs font-bold uppercase tracking-wide text-black/50 hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
