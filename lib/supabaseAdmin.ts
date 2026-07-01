import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SERVICE ROLE key. It bypasses RLS and
// must NEVER be imported into a client component or exposed to the browser.
// Used by the Stripe webhook to write membership status (the browser can only
// read its own members row). Null when the service key isn't set.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;
