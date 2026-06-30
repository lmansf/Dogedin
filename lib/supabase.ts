import { createClient } from "@supabase/supabase-js";

// ponytail: wired but intentionally unused until there's custom content to store
// (carousel CMS entries, newsletter signups). Shopify owns commerce, not this.
// Null when env is absent so the app builds/runs without Supabase creds.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
