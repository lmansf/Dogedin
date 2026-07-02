// Shared helpers for the Dogedin "dog of the day" pipeline Edge Functions.
// Runs on Deno (Supabase Edge Functions) — see docs/instagram-pipeline.md.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// CORS: publish-post / daily-post are invoked from the admin browser via
// supabase.functions.invoke, so preflight + headers are required.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Service-role client: bypasses RLS. Edge Functions get SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY injected automatically.
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function bearer(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
}

// True when the caller presented the service-role key (pg_cron / server jobs).
export function isServiceRole(req: Request): boolean {
  const token = bearer(req);
  return token.length > 0 && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

// Resolve the caller to any signed-in user (or the service role). Returns a
// user id / "service", or null for anonymous callers.
export async function requireUser(
  req: Request,
  service: SupabaseClient,
): Promise<string | null> {
  if (isServiceRole(req)) return "service";
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await service.auth.getUser(token);
  return error || !data?.user ? null : data.user.id;
}

// Resolve the caller's user from their JWT and require app_admins membership.
// Returns the admin's user id, or null when the caller isn't an admin.
export async function requireAdmin(
  req: Request,
  service: SupabaseClient,
): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await service.auth.getUser(token);
  const user = data?.user;
  if (error || !user?.email) return null;
  const { data: row } = await service
    .from("app_admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();
  return row ? user.id : null;
}

// --- Caption generation (Anthropic API) -------------------------------------

// The LLM writes prose only; hashtags are appended in code so output stays
// consistent across the dozens of posts a human has to approve.
const HASHTAGS = "#dogsofinstagram #dunedinflorida #dogedin";

export async function generateCaption(dog: {
  dog_name: string;
  breed: string | null;
  bio: string | null;
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5",
      max_tokens: 300,
      system:
        "You write warm, playful Instagram captions for a dog community account " +
        "in Dunedin, Florida. Keep captions to 1-3 short sentences. Do NOT " +
        "invent facts not provided. Return only the caption text, no preamble.",
      messages: [
        {
          role: "user",
          content:
            `Dog: ${dog.dog_name}\n` +
            `Breed: ${dog.breed ?? "unknown"}\n` +
            `Fun fact: ${dog.bio ?? "none provided"}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") {
    throw new Error("Caption generation was refused");
  }
  const textBlock = (data.content ?? []).find(
    (b: { type: string }) => b.type === "text",
  );
  const prose = textBlock?.text?.trim();
  if (!prose) throw new Error("Anthropic returned no caption text");

  return `${prose}\n\n${HASHTAGS}`;
}

// --- Instagram publishing (Graph API content publishing) --------------------

const GRAPH = "https://graph.facebook.com/v21.0";

async function graphError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? `HTTP ${res.status}`;
}

export type PublishResult =
  | { ok: true; mediaId: string; permalink: string | null }
  | { ok: false; rateLimited?: boolean; error: string };

// Publish one queue row to Instagram (two-step: create container → publish),
// then update the row. Respects IG's ~25 posts / 24h account cap: when at the
// cap we return rateLimited WITHOUT marking the row failed, so it stays
// approved and goes out on a later run. Real failures mark the row 'failed'
// with the error (retryable from /admin/posts).
export async function publishQueueRow(
  service: SupabaseClient,
  row: { id: string; caption: string; photo_url: string },
): Promise<PublishResult> {
  const igUserId = Deno.env.get("IG_USER_ID");
  const token = Deno.env.get("IG_ACCESS_TOKEN");
  if (!igUserId || !token) {
    return { ok: false, error: "IG_USER_ID / IG_ACCESS_TOKEN not configured" };
  }

  // Daily publishing cap (IG allows ~25 API-published posts per 24h).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await service
    .from("post_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .gte("published_at", since);
  if ((count ?? 0) >= 25) {
    return { ok: false, rateLimited: true, error: "IG daily publish cap reached" };
  }

  const fail = async (error: string): Promise<PublishResult> => {
    await service
      .from("post_queue")
      .update({ status: "failed", error: error.slice(0, 500) })
      .eq("id", row.id);
    return { ok: false, error };
  };

  try {
    // 1. Create the media container.
    const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: "POST",
      body: new URLSearchParams({
        image_url: row.photo_url,
        caption: row.caption,
        access_token: token,
      }),
    });
    if (!containerRes.ok) {
      return await fail(`container: ${await graphError(containerRes)}`);
    }
    const creationId = (await containerRes.json()).id as string;

    // 2. Publish it.
    const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: token,
      }),
    });
    if (!publishRes.ok) {
      return await fail(`publish: ${await graphError(publishRes)}`);
    }
    const mediaId = (await publishRes.json()).id as string;

    // 3. Fetch the permalink (best-effort).
    let permalink: string | null = null;
    const permaRes = await fetch(
      `${GRAPH}/${mediaId}?fields=permalink&access_token=${token}`,
    );
    if (permaRes.ok) permalink = (await permaRes.json()).permalink ?? null;

    await service
      .from("post_queue")
      .update({
        status: "published",
        ig_media_id: mediaId,
        ig_permalink: permalink,
        published_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", row.id);

    return { ok: true, mediaId, permalink };
  } catch (e) {
    return await fail(e instanceof Error ? e.message : String(e));
  }
}

// --- Admin notification (pluggable) ------------------------------------------

// Best-effort ping to a Slack/Discord-style webhook. Sends both `text` (Slack)
// and `content` (Discord) so either works. No-op when unconfigured.
export async function notifyAdmin(message: string): Promise<void> {
  const url = Deno.env.get("ADMIN_NOTIFY_WEBHOOK");
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, content: message }),
    });
  } catch {
    // Notification failures must never break the pipeline.
  }
}
