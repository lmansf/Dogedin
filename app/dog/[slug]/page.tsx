import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPublicDog, dogPhotoUrl } from "@/lib/dogProfiles";

// Public dog profile. This is the URL a physical tag / QR code will point to in
// Phase 2 (/dog/{slug}). Contact details render only when the owner opted in.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dog = await getPublicDog(slug);
  return {
    title: dog ? `${dog.dogName} · Dogedin` : "Dog not found · Dogedin",
  };
}

export default async function DogProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dog = await getPublicDog(slug);

  if (!dog) {
    return (
      <div className="mx-auto max-w-lg border-[3px] border-black bg-white p-8 text-center shadow-hard">
        <p className="text-5xl">🐾</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold">
          No dog found here
        </h1>
        <p className="mt-2 text-sm text-black/60">
          This profile link doesn&apos;t match any registered dog.
        </p>
        <Link
          href="/dogs"
          className="mt-4 inline-block border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard"
        >
          Search for a dog →
        </Link>
      </div>
    );
  }

  const img = dogPhotoUrl(dog.photoPath);
  const hasContact = dog.lostContactOptIn && (dog.ownerPhone || dog.ownerEmail);

  return (
    <article className="mx-auto flex max-w-2xl flex-col overflow-hidden border-[3px] border-black bg-white shadow-hard-lg">
      <div className="relative aspect-[4/3] border-b-[3px] border-black bg-zinc-100">
        {img ? (
          <Image
            src={img}
            alt={dog.dogName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl">🐶</div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-6">
        <span className="w-fit -rotate-2 border-2 border-black bg-[var(--gold)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
          Dogedin profile
        </span>
        <h1 className="font-display text-4xl font-extrabold leading-tight">
          Meet {dog.dogName}
        </h1>
        {dog.breed && (
          <p className="text-lg font-bold text-black/60">{dog.breed}</p>
        )}

        {dog.lostContactOptIn ? (
          hasContact ? (
            <div className="mt-2 border-[3px] border-black bg-[var(--coral)]/15 p-4">
              <p className="font-display text-lg font-extrabold">
                🚨 Found me? Contact my human
              </p>
              <div className="mt-2 flex flex-col gap-1 text-sm font-semibold">
                {dog.ownerPhone && (
                  <a href={`tel:${dog.ownerPhone}`} className="underline">
                    📞 {dog.ownerPhone}
                  </a>
                )}
                {dog.ownerEmail && (
                  <a href={`mailto:${dog.ownerEmail}`} className="underline">
                    ✉️ {dog.ownerEmail}
                  </a>
                )}
              </div>
            </div>
          ) : null
        ) : (
          <p className="mt-2 border-2 border-black bg-[var(--sand)] px-3 py-2 text-sm font-bold text-black/60">
            🔒 This owner has kept their contact details private.
          </p>
        )}
      </div>
    </article>
  );
}
