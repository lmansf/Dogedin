// Thin Shopify Storefront API client. No SDK — just a typed fetch.
// Shopify is the source of truth for catalog, pricing, and discounts.

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
  price: number;
  compareAtPrice: number | null;
  currency: string;
};

const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes {
        id
        handle
        title
        description
        featuredImage { url altText }
        variants(first: 1) {
          nodes {
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
          }
        }
      }
    }
  }
`;

export async function getProducts(first = 12): Promise<Product[]> {
  // ponytail: no creds yet → return [] so the site builds and renders without Shopify.
  if (!domain || !token) return [];

  const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { first } }),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`Shopify Storefront API ${res.status}`);

  const json = await res.json();
  if (json.errors) throw new Error(`Shopify: ${JSON.stringify(json.errors)}`);

  return (json.data?.products?.nodes ?? []).map(toProduct);
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
    price,
    // Only treat compareAtPrice as a discount when it's genuinely higher.
    compareAtPrice: compareAt && compareAt > price ? compareAt : null,
    currency: variant?.price.currencyCode ?? "USD",
  };
}
