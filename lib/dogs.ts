// The "Meet the pack" roster shown in the dog card carousel on the home page.
// These are the storefront's mascots - a Dunedin, FL flavoured cast of good
// dogs. Photos come from images.dog.ceo (allow-listed in next.config.mjs); if a
// photo ever fails to load, DogCard falls back to the dog's emoji on its accent
// gradient, so a broken URL still renders an on-brand card.
export type Dog = {
  id: string;
  name: string;
  breed: string;
  about: string;
  image: string;
  emoji: string; // fallback face when the photo can't load
  grad: string; // tailwind gradient classes for the fallback + accent
};

// Unified card shape for the "Meet the pack" carousel: either a mascot (below)
// or a real registered dog from the community. href links a real dog to their
// profile page; mascots have no page (yet), so href is null. dogId is the real
// profile UUID (null for mascots) — present dogs are pawable; pawCount is the
// current profile-paw tally shown on the card.
export type PackDog = {
  id: string;
  name: string;
  breed: string;
  about: string;
  image: string | null;
  emoji: string;
  grad: string;
  href: string | null;
  dogId: string | null;
  pawCount: number;
};

// Rotating accent gradients for real community dogs (mascots carry their own).
export const PACK_GRADS = [
  "from-[var(--turq)] to-[var(--sky)]",
  "from-[var(--gold)] to-[var(--amber)]",
  "from-[var(--green)] to-[var(--navy)]",
  "from-[var(--orange)] to-[var(--coral)]",
  "from-[var(--sky)] to-[var(--gold)]",
];

export function mascotsAsPack(): PackDog[] {
  // Mascots are the empty-roster fallback — not real dogs, so no profile to
  // paw (dogId null) and no tally.
  return DOGS.map((d) => ({ ...d, href: null, dogId: null, pawCount: 0 }));
}

export const DOGS: Dog[] = [
  {
    id: "angus",
    name: "Angus",
    breed: "Scottish Terrier",
    about:
      "Highland-born and Dunedin-raised. Angus keeps his tartan bandana on at all times and judges every craft beer by its head of foam.",
    image: "https://images.dog.ceo/breeds/terrier-scottish/n02097298_2138.jpg",
    emoji: "🏴",
    grad: "from-[var(--green)] to-[var(--navy)]",
  },
  {
    id: "biscuit",
    name: "Biscuit",
    breed: "Golden Retriever",
    about:
      "Professional beach greeter at Honeymoon Island. Biscuit has never met a tennis ball, a stranger, or a tide pool she didn't love.",
    image: "https://images.dog.ceo/breeds/retriever-golden/n02099601_3004.jpg",
    emoji: "🏖️",
    grad: "from-[var(--turq)] to-[var(--sky)]",
  },
  {
    id: "sunny",
    name: "Sunny",
    breed: "Pembroke Corgi",
    about:
      "Short legs, long opinions. Sunny runs the citrus-crate patrol and expects an orange slice as payment at the end of every shift.",
    image: "https://images.dog.ceo/breeds/corgi-cardigan/n02113186_1030.jpg",
    emoji: "🌅",
    grad: "from-[var(--orange)] to-[var(--coral)]",
  },
  {
    id: "maple",
    name: "Maple",
    breed: "Australian Shepherd",
    about:
      "Herds kayakers back to shore whether they asked for it or not. Maple's off-switch was recalled at the factory and never replaced.",
    image: "https://images.dog.ceo/breeds/australian-shepherd/pepper.jpg",
    emoji: "🐑",
    grad: "from-[var(--gold)] to-[var(--amber)]",
  },
  {
    id: "nessie",
    name: "Nessie",
    breed: "Border Collie",
    about:
      "Named for a monster, gentle as a lamb. Nessie has solved every puzzle feeder in town and is now working on the front door.",
    image: "https://images.dog.ceo/breeds/collie-border/n02106166_1031.jpg",
    emoji: "🧠",
    grad: "from-[var(--navy)] to-[var(--turq)]",
  },
  {
    id: "pepper",
    name: "Pepper",
    breed: "Samoyed",
    about:
      "A cloud that learned to fetch. Pepper sheds enough each spring to knit a second Pepper and supervises the treat counter with zero mercy.",
    image: "https://images.dog.ceo/breeds/samoyed/n02111889_1249.jpg",
    emoji: "☁️",
    grad: "from-[var(--sky)] to-[var(--gold)]",
  },
];
