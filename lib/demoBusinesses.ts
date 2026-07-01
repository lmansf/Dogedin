import type { Business } from "@/lib/businesses";

// Seed roster of Dunedin, FL businesses for the "Things to do" page. Used as a
// fallback so the page looks alive before Supabase is wired up (mirrors
// lib/demoProducts.ts). Images are self-hosted SVGs under /public/assets/spots.
// Two entries are already "linked to a real place" (placeId set) and carry a
// partner offer, to show how discounts surface on reviews once a business is
// matched to a real-world listing.
export const DEMO_BUSINESSES: Business[] = [
  {
    id: "dunedin-brewery",
    slug: "dunedin-brewery",
    name: "Dunedin Brewery",
    category: "Brewery",
    neighborhood: "Downtown Dunedin",
    description:
      "Florida's oldest craft brewery, with a shaded patio where good dogs are as welcome as the beer.",
    image: "/assets/spots/dunedin-brewery.svg",
    dogFriendly: true,
    placeId: "demo-place-dunedin-brewery",
    offer: {
      label: "$1 off pints",
      detail: "Show this review at the bar",
      code: "DOGEDIN",
    },
    reviews: [
      {
        id: "r-brew-1",
        businessId: "dunedin-brewery",
        author: "Angus's human",
        rating: 5,
        body: "Water bowls at every table and the bartenders keep treats behind the bar. Angus asks to go back daily.",
        upvotes: 12,
        createdAt: "2026-05-18",
        replies: [
          {
            id: "rep-brew-1",
            reviewId: "r-brew-1",
            author: "Maggie R.",
            body: "Second this — ask for the patio out back, it's the shadiest in summer.",
            createdAt: "2026-05-19",
          },
        ],
      },
      {
        id: "r-brew-2",
        businessId: "dunedin-brewery",
        author: "Callum P.",
        rating: 4,
        body: "Great tartan-ish vibe and live music on weekends. Patio gets busy but the pups don't mind.",
        upvotes: 3,
        createdAt: "2026-04-02",
        replies: [],
      },
    ],
  },
  {
    id: "honeymoon-island-dog-beach",
    slug: "honeymoon-island-dog-beach",
    name: "Honeymoon Island Dog Beach",
    category: "Beach",
    neighborhood: "Honeymoon Island",
    description:
      "A dedicated off-leash stretch of Gulf shoreline. Shallow, calm water perfect for first-time swimmers.",
    image: "/assets/spots/honeymoon-island.svg",
    dogFriendly: true,
    placeId: null,
    offer: null,
    reviews: [
      {
        id: "r-beach-1",
        businessId: "honeymoon-island-dog-beach",
        author: "Biscuit's dad",
        rating: 5,
        body: "The best. Biscuit met twenty new friends and passed out in the car before we hit the causeway.",
        upvotes: 21,
        createdAt: "2026-06-11",
        replies: [
          {
            id: "rep-beach-1",
            reviewId: "r-beach-1",
            author: "Priya S.",
            body: "Bring water and a shade tent — there isn't much cover once the sun's up.",
            createdAt: "2026-06-12",
          },
        ],
      },
    ],
  },
  {
    id: "kellys-chic-a-boom",
    slug: "kellys-chic-a-boom",
    name: "Kelly's Chic-a-Boom Room",
    category: "Restaurant",
    neighborhood: "Downtown Dunedin",
    description:
      "Brunch institution with a leafy dog-friendly patio and a pup menu that's arguably better than the human one.",
    image: "/assets/spots/kellys.svg",
    dogFriendly: true,
    placeId: "demo-place-kellys",
    offer: {
      label: "Free pup-cup",
      detail: "With any entrée — mention Dogedin",
      code: null,
    },
    reviews: [
      {
        id: "r-kelly-1",
        businessId: "kellys-chic-a-boom",
        author: "Sunny's people",
        rating: 5,
        body: "The pup-cup is a scoop of whipped cream and a biscuit. Sunny now pulls us down Main Street toward it.",
        upvotes: 8,
        createdAt: "2026-05-30",
        replies: [],
      },
    ],
  },
  {
    id: "hammock-park",
    slug: "hammock-park",
    name: "Hammock Park",
    category: "Park",
    neighborhood: "Dunedin",
    description:
      "Quiet boardwalk trails through oak hammock and wetlands. Shady, flat, and blissfully uncrowded on weekdays.",
    image: "/assets/spots/hammock-park.svg",
    dogFriendly: true,
    placeId: null,
    offer: null,
    reviews: [
      {
        id: "r-hammock-1",
        businessId: "hammock-park",
        author: "Nessie's human",
        rating: 5,
        body: "Perfect sniffari. Boardwalks keep paws out of the mud and the birdsong keeps Nessie fascinated.",
        upvotes: 5,
        createdAt: "2026-04-19",
        replies: [],
      },
    ],
  },
];
