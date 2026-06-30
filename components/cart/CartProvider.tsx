"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import type { Cart } from "@/lib/shopify";
import {
  addItem,
  fetchCart,
  removeItem,
  setQuantity,
} from "@/app/cart/actions";

type CartContextValue = {
  cart: Cart | null;
  open: boolean;
  pending: boolean;
  error: string | null;
  setOpen: (open: boolean) => void;
  add: (variantId: string) => void;
  remove: (lineId: string) => void;
  changeQty: (lineId: string, quantity: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Hydrate any existing cart on mount.
  useEffect(() => {
    fetchCart()
      .then((c) => c && setCart(c))
      .catch(() => {});
  }, []);

  const run = useCallback(
    (op: () => Promise<Cart>, opensDrawer = false) => {
      setError(null);
      startTransition(async () => {
        try {
          const next = await op();
          setCart(next);
          if (opensDrawer) setOpen(true);
        } catch (e) {
          // Shopify isn't hooked up yet - show the error in the drawer instead of crashing.
          setError(e instanceof Error ? e.message : "Cart error");
          if (opensDrawer) setOpen(true);
        }
      });
    },
    []
  );

  const add = useCallback((variantId: string) => run(() => addItem(variantId), true), [run]);
  const remove = useCallback((lineId: string) => run(() => removeItem(lineId)), [run]);
  const changeQty = useCallback(
    (lineId: string, quantity: number) => run(() => setQuantity(lineId, quantity)),
    [run]
  );

  return (
    <CartContext.Provider
      value={{ cart, open, pending, error, setOpen, add, remove, changeQty }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
