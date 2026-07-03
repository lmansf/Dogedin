"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { mascotsAsPack, type PackDog } from "@/lib/dogs";

// "Meet the pack" carousel. A Netflix-style horizontal, snap-scrolling row of
// dog cards. Whichever card is nearest the centre of the track is "active" and
// expands into a landscape profile - photo on the left, "Meet {name}" and an
// about blurb on the right. Every other card collapses to a slim vertical
// portrait showing just the dog's face, and clicking one recentres it (making
// it the active card). The active card is derived purely from scroll position,
// so it keeps working while you drag/swipe; native scroll-snap does the rest.
//
// The roster is real registered community dogs (passed in from the server via
// lib/dogProfiles#listRecentDogs) with the mascot cast as the fallback while
// the pack is still small. A permanent final card invites the viewer's own dog
// into the lineup.
export default function DogCarousel({ pack }: { pack?: PackDog[] }) {
  const dogs = pack && pack.length > 0 ? pack : mascotsAsPack();
  const cardCount = dogs.length + 1; // + the "your dog belongs here" card
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // While a button/card click is driving the scroll (see focusCard), the
  // width of two cards is mid-transition at the same time as the scroll is
  // animating. The distance-to-centre check below can't tell that apart from
  // organic scrolling and will "correct" active back to whichever card is
  // still-mostly-expanded, undoing the click. Suppressed until that settles.
  const navigatingUntil = useRef(0);

  // Derive the active card from scroll position: the card whose centre sits
  // closest to the track's centre wins. Runs on scroll (rAF-throttled) + resize.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (Date.now() < navigatingUntil.current) return;
      const cards = Array.from(
        track.querySelectorAll<HTMLElement>("[data-card]")
      );
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let best = 0;
      let bestDist = Infinity;
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const dist = Math.abs(center - (r.left + r.width / 2));
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });

      // The side padding is sized to center an EXPANDED edge card. While
      // scrolling back toward card 0 (or the last card), it's still
      // collapsed/narrow, so even the hard scroll limit can't bring its
      // center as close to true-center as its already-expanded neighbour —
      // the distance check above picks that neighbour instead, and since
      // you're already at the scroll limit there's no further scrolling to
      // correct it. At the actual scroll boundaries, the boundary card wins
      // outright regardless of the distance math.
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft <= 1) {
        best = 0;
      } else if (track.scrollLeft >= maxScroll - 1) {
        best = cards.length - 1;
      }

      setActive(best);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, [cardCount]);

  // Scrolls card `i` into view and marks it active. We can't just hand this
  // off to the browser's scrollIntoView: it centres the target using its
  // CURRENT (still-collapsed) width, while the currently-active card is
  // still expanded at click time - so the maths it does is for a layout
  // that's about to change out from under it, and it often asks for a
  // negative scroll position that clamps to 0, landing on card 0 instead of
  // the intended card. Instead we predict the target's post-expand position
  // from measurements taken now, before anything moves.
  const focusCard = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.querySelectorAll<HTMLElement>("[data-card]"));
    const current = cards[active];
    const target = cards[i];
    if (!target) return;

    if (current && target !== current) {
      const trackRect = track.getBoundingClientRect();
      const currentRect = current.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      // Collapsing the active card shrinks it from currentRect.width down to
      // targetRect.width, pulling every later sibling left by the
      // difference - but only if the target comes after it in the row.
      const widthDelta = currentRect.width - targetRect.width;
      const shift = i > active ? widthDelta : 0;
      const futureLeft = targetRect.left + track.scrollLeft - shift;
      const futureCenter = futureLeft + currentRect.width / 2; // target expands to the same width `current` has now
      const desiredScroll = futureCenter - trackRect.width / 2;
      navigatingUntil.current = Date.now() + 500;
      setActive(i);
      track.scrollTo({ left: desiredScroll, behavior: "smooth" });
      return;
    }

    navigatingUntil.current = Date.now() + 500;
    setActive(i);
    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const nudge = (dir: 1 | -1) =>
    focusCard(Math.min(cardCount - 1, Math.max(0, active + dir)));

  return (
    <section className="border-[3px] border-black bg-white p-3 shadow-hard-lg sm:p-4">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            Meet the pack 🐾
          </h2>
          <span className="hidden -rotate-2 border-2 border-black bg-[var(--turq)] px-3 py-1 text-xs font-black uppercase text-[var(--sand)] shadow-hard sm:inline-block">
            Dunedin&apos;s very good dogs
          </span>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/register"
            className="text-xs font-black uppercase tracking-wide text-[var(--turq)] hover:underline"
          >
            Add your dog →
          </Link>
          <NudgeButton dir={-1} disabled={active === 0} onClick={() => nudge(-1)} />
          <NudgeButton
            dir={1}
            disabled={active === cardCount - 1}
            onClick={() => nudge(1)}
          />
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-[8%] py-2 sm:px-[15%]"
      >
        {dogs.map((dog, i) => (
          <DogCard
            key={dog.id}
            dog={dog}
            active={i === active}
            onSelect={() => focusCard(i)}
          />
        ))}
        <RegisterCard
          active={active === cardCount - 1}
          onSelect={() => focusCard(cardCount - 1)}
        />
      </div>
    </section>
  );
}

function DogCard({
  dog,
  active,
  onSelect,
}: {
  dog: PackDog;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      data-card
      className={`h-[300px] shrink-0 origin-center snap-center transition-[width] duration-300 ease-out sm:h-[340px] ${
        active ? "w-[86vw] sm:w-[640px]" : "w-[42vw] sm:w-[210px]"
      }`}
    >
      <div
        className={`flex h-full w-full overflow-hidden rounded-xl border-[3px] border-black bg-[var(--sand)] shadow-hard ${
          active ? "" : "cursor-pointer transition-transform hover:-translate-y-1"
        }`}
        role={active ? undefined : "button"}
        tabIndex={active ? undefined : 0}
        aria-label={active ? undefined : `Meet ${dog.name}`}
        onClick={active ? undefined : onSelect}
        onKeyDown={
          active
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect();
                }
              }
        }
      >
        {/* Photo. Half-width in the landscape (active) card, full-bleed and
            centred in the collapsed portrait cards. */}
        <div
          className={`relative shrink-0 bg-zinc-100 ${
            active ? "w-1/2 border-r-[3px] border-black" : "w-full"
          }`}
        >
          <DogPhoto dog={dog} priority={active} />
          {!active && (
            <span className="absolute inset-x-2 bottom-2 truncate border-2 border-black bg-white/95 px-2 py-1 text-center text-xs font-extrabold uppercase tracking-wide">
              {dog.name}
            </span>
          )}
        </div>

        {/* About panel - only rendered for the active landscape card. */}
        {active && (
          <div className="flex w-1/2 flex-col justify-center gap-3 p-5 sm:p-6">
            <span className="w-fit -rotate-2 border-2 border-black bg-[var(--turq)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--sand)]">
              {dog.breed}
            </span>
            <h3 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              Meet {dog.name}
            </h3>
            <p className="text-sm leading-relaxed text-black/70 sm:text-base">
              {dog.about}
            </p>
            {dog.href && (
              <Link
                href={dog.href}
                className="w-fit border-2 border-black bg-[var(--gold)] px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5"
              >
                Visit {dog.name}&apos;s page →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// The permanent last card: an open spot in the lineup for the viewer's dog.
function RegisterCard({
  active,
  onSelect,
}: {
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      data-card
      className={`h-[300px] shrink-0 origin-center snap-center transition-[width] duration-300 ease-out sm:h-[340px] ${
        active ? "w-[86vw] sm:w-[640px]" : "w-[42vw] sm:w-[210px]"
      }`}
    >
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-xl border-[3px] border-dashed border-black bg-white shadow-hard ${
          active ? "" : "cursor-pointer transition-transform hover:-translate-y-1"
        }`}
        role={active ? undefined : "button"}
        tabIndex={active ? undefined : 0}
        aria-label={active ? undefined : "Register your dog"}
        onClick={active ? undefined : onSelect}
        onKeyDown={
          active
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect();
                }
              }
        }
      >
        {active ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="text-5xl">🐾</span>
            <h3 className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              Your dog belongs here
            </h3>
            <p className="max-w-sm text-sm text-black/60">
              Every Dunedin dog gets a free profile page — and a spot in this
              lineup.
            </p>
            <Link
              href="/register"
              className="border-[3px] border-black bg-[var(--turq)] px-4 py-2 text-sm font-black uppercase tracking-wide text-[var(--sand)] shadow-hard transition-transform hover:-translate-y-0.5"
            >
              Register your dog →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-3 text-center">
            <span className="text-4xl">🐾</span>
            <span className="text-xs font-extrabold uppercase tracking-wide text-black/50">
              Your dog?
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Renders the dog photo, falling back to the dog's emoji on its accent gradient
// if there's no photo or it can't load (e.g. a stale URL). Client-side onError
// keeps the carousel looking intentional even when a photo 404s.
function DogPhoto({ dog, priority }: { dog: PackDog; priority: boolean }) {
  const [failed, setFailed] = useState(false);

  if (!dog.image || failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${dog.grad}`}
      >
        <span className="text-6xl drop-shadow">{dog.emoji}</span>
      </div>
    );
  }

  return (
    <Image
      src={dog.image}
      alt={`${dog.name}, a ${dog.breed}`}
      fill
      priority={priority}
      sizes="(max-width: 640px) 86vw, 320px"
      className="object-cover object-center"
      onError={() => setFailed(true)}
    />
  );
}

function NudgeButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 1 | -1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 1 ? "Next dog" : "Previous dog"}
      className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-[var(--gold)] text-lg font-black shadow-hard transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
    >
      {dir === 1 ? "→" : "←"}
    </button>
  );
}
