"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DOGS, type Dog } from "@/lib/dogs";

// "Meet the pack" carousel. A Netflix-style horizontal, snap-scrolling row of
// dog cards. Whichever card is nearest the centre of the track is "active" and
// expands into a landscape profile - photo on the left, "Meet {name}" and an
// about blurb on the right. Every other card collapses to a slim vertical
// portrait showing just the dog's face, and clicking one recentres it (making
// it the active card). The active card is derived purely from scroll position,
// so it keeps working while you drag/swipe; native scroll-snap does the rest.
export default function DogCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Derive the active card from scroll position: the card whose centre sits
  // closest to the track's centre wins. Runs on scroll (rAF-throttled) + resize.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;

    const update = () => {
      frame = 0;
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
  }, []);

  const focusCard = (i: number) => {
    const track = trackRef.current;
    const card = track?.querySelectorAll<HTMLElement>("[data-card]")[i];
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const nudge = (dir: 1 | -1) =>
    focusCard(Math.min(DOGS.length - 1, Math.max(0, active + dir)));

  return (
    <section className="border-[3px] border-black bg-white p-3 shadow-hard-lg sm:p-4">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            Meet the pack 🐾
          </h2>
          <span className="hidden -rotate-2 border-2 border-black bg-[var(--turq)] px-3 py-1 text-xs font-black uppercase text-[var(--sand)] shadow-hard sm:inline-block">
            Very good dogs
          </span>
        </div>
        <div className="hidden gap-2 sm:flex">
          <NudgeButton dir={-1} disabled={active === 0} onClick={() => nudge(-1)} />
          <NudgeButton
            dir={1}
            disabled={active === DOGS.length - 1}
            onClick={() => nudge(1)}
          />
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-[8%] py-2 sm:px-[15%]"
      >
        {DOGS.map((dog, i) => (
          <DogCard
            key={dog.id}
            dog={dog}
            active={i === active}
            onSelect={() => focusCard(i)}
          />
        ))}
      </div>
    </section>
  );
}

function DogCard({
  dog,
  active,
  onSelect,
}: {
  dog: Dog;
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
          </div>
        )}
      </div>
    </div>
  );
}

// Renders the dog photo, falling back to the dog's emoji on its accent gradient
// if the image can't load (e.g. a stale dog.ceo URL). Client-side onError keeps
// the carousel looking intentional even when a photo 404s.
function DogPhoto({ dog, priority }: { dog: Dog; priority: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
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
