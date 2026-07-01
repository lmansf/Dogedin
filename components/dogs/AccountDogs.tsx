"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { dogPhotoUrl, DOG_PHOTO_BUCKET } from "@/lib/dogProfiles";
import { useSupabaseUser, AuthPanel, signOut } from "./auth";

type MyDog = {
  id: string;
  slug: string;
  dog_name: string;
  breed: string | null;
  photo_path: string | null;
  lost_contact_opt_in: boolean;
};

// The signed-in owner's dogs. Reads are scoped to the user by RLS
// (auth.uid() = user_id), so this simple select only ever returns their rows.
export default function AccountDogs() {
  const { user, loading, configured } = useSupabaseUser();
  const [dogs, setDogs] = useState<MyDog[] | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("dog_profiles")
      .select("id, slug, dog_name, breed, photo_path, lost_contact_opt_in")
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
                className="flex items-center gap-4 border-[3px] border-black bg-white p-3 shadow-hard"
              >
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
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Link
                    href={`/dog/${dog.slug}`}
                    className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
                  >
                    View →
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(dog)}
                    className="text-xs font-bold uppercase tracking-wide text-[var(--red)] hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
