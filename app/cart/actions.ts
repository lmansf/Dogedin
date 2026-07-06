"use server";

import { cookies } from "next/headers";
import {
  addToCart,
  createCart,
  getCart,
  removeFromCart,
  updateCartLine,
  type Cart,
  type CartLineAttribute,
} from "@/lib/shopify";

const COOKIE = "dogedin_cart";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

async function readCartId() {
  return (await cookies()).get(COOKIE)?.value;
}

// Load the current cart, if any. Returns null when there's no cart yet.
// Swallows a stale/expired cart id rather than throwing on read.
export async function fetchCart(): Promise<Cart | null> {
  const id = await readCartId();
  if (!id) return null;
  try {
    return await getCart(id);
  } catch {
    return null;
  }
}

export async function addItem(
  variantId: string,
  attributes: CartLineAttribute[] = []
): Promise<Cart> {
  const store = await cookies();
  let id = store.get(COOKIE)?.value;

  if (!id) {
    const created = await createCart();
    store.set(COOKIE, created.id, COOKIE_OPTS);
    id = created.id;
  }

  return addToCart(id, variantId, 1, attributes);
}

export async function setQuantity(
  lineId: string,
  quantity: number
): Promise<Cart> {
  const id = await readCartId();
  if (!id) throw new Error("No cart");
  if (quantity <= 0) return removeFromCart(id, [lineId]);
  return updateCartLine(id, lineId, quantity);
}

export async function removeItem(lineId: string): Promise<Cart> {
  const id = await readCartId();
  if (!id) throw new Error("No cart");
  return removeFromCart(id, [lineId]);
}
