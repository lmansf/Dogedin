// Thin Shopify Storefront API client. No SDK - just a typed fetch.
// Shopify is the source of truth for catalog, pricing, discounts, and cart.

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
const API_VERSION = "2024-10";

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: string | null;
  imageAlt: string;
  variantId: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
};

export type CartLine = {
  id: string;
  quantity: number;
  variantId: string;
  title: string;
  productTitle: string;
  image: string | null;
  price: number;
  currency: string;
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  subtotal: number;
  currency: string;
  lines: CartLine[];
};

// Core fetch. Throws when unconfigured or on API errors - callers decide how to
// handle it (catalog degrades to empty; cart surfaces the error to the user).
async function storefront<T = any>(
  query: string,
  variables: Record<string, unknown> = {},
  init: RequestInit = { cache: "no-store" }
): Promise<T> {
  if (!domain || !token) {
    throw new Error("Shopify is not configured (missing store domain or token).");
  }

  const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    ...init,
  });

  if (!res.ok) throw new Error(`Shopify Storefront API ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Shopify: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

/* -------------------------------------------------------------------------- */
/* Catalog                                                                    */
/* -------------------------------------------------------------------------- */

const PRODUCT_FIELDS = /* GraphQL */ `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    featuredImage { url altText }
    variants(first: 1) {
      nodes {
        id
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
      }
    }
  }
`;

const PRODUCTS_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  query Products($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes { ...ProductFields }
    }
  }
`;

const COLLECTION_QUERY = /* GraphQL */ `
  ${PRODUCT_FIELDS}
  query Collection($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      products(first: $first) {
        nodes { ...ProductFields }
      }
    }
  }
`;

export async function getProducts(first = 12): Promise<Product[]> {
  // Catalog degrades gracefully: no creds yet -> empty grid, site still renders.
  if (!domain || !token) return [];
  const data = await storefront(PRODUCTS_QUERY, { first }, { next: { revalidate: 300 } });
  return (data?.products?.nodes ?? []).map(toProduct);
}

// Products in a single Shopify collection (e.g. "for-dogs"). One collection
// drives one ProductRow. Returns [] when unconfigured or the handle is unknown,
// so a missing collection just yields an empty row instead of an error.
export async function getCollection(
  handle: string,
  first = 12
): Promise<Product[]> {
  if (!domain || !token) return [];
  const data = await storefront(COLLECTION_QUERY, { handle, first }, { next: { revalidate: 300 } });
  return (data?.collection?.products?.nodes ?? []).map(toProduct);
}

function toProduct(node: any): Product {
  const variant = node.variants?.nodes?.[0];
  const compareAt = variant?.compareAtPrice
    ? Number(variant.compareAtPrice.amount)
    : null;
  const price = variant ? Number(variant.price.amount) : 0;
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description ?? "",
    image: node.featuredImage?.url ?? null,
    imageAlt: node.featuredImage?.altText ?? node.title,
    variantId: variant?.id ?? "",
    price,
    // Only treat compareAtPrice as a discount when it's genuinely higher.
    compareAtPrice: compareAt && compareAt > price ? compareAt : null,
    currency: variant?.price.currencyCode ?? "USD",
  };
}

/* -------------------------------------------------------------------------- */
/* Cart                                                                       */
/* -------------------------------------------------------------------------- */

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartParts on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            product { title featuredImage { url altText } }
          }
        }
      }
    }
  }
`;

export async function createCart(): Promise<Cart> {
  const data = await storefront(
    `${CART_FRAGMENT}
     mutation { cartCreate { cart { ...CartParts } } }`
  );
  return mapCart(data.cartCreate.cart);
}

export async function getCart(id: string): Promise<Cart | null> {
  const data = await storefront(
    `${CART_FRAGMENT}
     query Cart($id: ID!) { cart(id: $id) { ...CartParts } }`,
    { id }
  );
  return data.cart ? mapCart(data.cart) : null;
}

export async function addToCart(
  cartId: string,
  variantId: string,
  quantity = 1
): Promise<Cart> {
  const data = await storefront(
    `${CART_FRAGMENT}
     mutation Add($cartId: ID!, $lines: [CartLineInput!]!) {
       cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartParts } }
     }`,
    { cartId, lines: [{ merchandiseId: variantId, quantity }] }
  );
  return mapCart(data.cartLinesAdd.cart);
}

export async function updateCartLine(
  cartId: string,
  lineId: string,
  quantity: number
): Promise<Cart> {
  const data = await storefront(
    `${CART_FRAGMENT}
     mutation Update($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
       cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartParts } }
     }`,
    { cartId, lines: [{ id: lineId, quantity }] }
  );
  return mapCart(data.cartLinesUpdate.cart);
}

export async function removeFromCart(
  cartId: string,
  lineIds: string[]
): Promise<Cart> {
  const data = await storefront(
    `${CART_FRAGMENT}
     mutation Remove($cartId: ID!, $lineIds: [ID!]!) {
       cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartParts } }
     }`,
    { cartId, lineIds }
  );
  return mapCart(data.cartLinesRemove.cart);
}

function mapCart(c: any): Cart {
  return {
    id: c.id,
    checkoutUrl: c.checkoutUrl,
    totalQuantity: c.totalQuantity,
    subtotal: Number(c.cost.subtotalAmount.amount),
    currency: c.cost.subtotalAmount.currencyCode,
    lines: (c.lines?.nodes ?? []).map((l: any) => ({
      id: l.id,
      quantity: l.quantity,
      variantId: l.merchandise.id,
      title: l.merchandise.title,
      productTitle: l.merchandise.product.title,
      image: l.merchandise.product.featuredImage?.url ?? null,
      price: Number(l.merchandise.price.amount),
      currency: l.merchandise.price.currencyCode,
    })),
  };
}
