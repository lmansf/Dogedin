"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Review, Reply } from "@/lib/businesses";

// Server actions for the "Things to do in Dunedin" page: adding reviews,
// upvoting them, and replying. Each persists to Supabase when it's configured
// and otherwise returns a `persisted: false` result so the UI can still update
// for the current session (read-only "preview" mode off the demo seed).
//
// Results are discriminated unions: `{ ok: true, ... }` on success (with the
// created entity so the client can render it immediately) or `{ ok: false,
// error }` when validation fails or a configured backend write errors.

const PATH = "/things-to-do";
const today = () => new Date().toISOString().slice(0, 10);
const clean = (s: string, max: number) => s.trim().replace(/\s+/g, " ").slice(0, max);

export type AddReviewResult =
  | { ok: true; review: Review; persisted: boolean }
  | { ok: false; error: string };

export async function addReview(input: {
  businessId: string;
  author: string;
  rating: number;
  body: string;
}): Promise<AddReviewResult> {
  const author = clean(input.author ?? "", 60);
  const body = clean(input.body ?? "", 1000);
  const rating = Math.round(Number(input.rating));

  if (!author) return { ok: false, error: "Please add your name." };
  if (body.length < 3) return { ok: false, error: "Your review is a little short." };
  if (!(rating >= 1 && rating <= 5))
    return { ok: false, error: "Pick a rating from 1 to 5 stars." };

  const review: Review = {
    id: randomUUID(),
    businessId: input.businessId,
    author,
    rating,
    body,
    upvotes: 0,
    createdAt: today(),
    replies: [],
  };

  if (!supabase) return { ok: true, review, persisted: false };

  try {
    const { data, error } = await supabase
      .from("reviews")
      .insert({ business_id: input.businessId, author, rating, body })
      .select("id, created_at")
      .single();
    if (error || !data) return { ok: false, error: "Couldn't save your review — try again." };
    review.id = data.id;
    review.createdAt = String(data.created_at).slice(0, 10);
    revalidatePath(PATH);
    return { ok: true, review, persisted: true };
  } catch {
    return { ok: false, error: "Couldn't save your review — try again." };
  }
}

export type UpvoteResult =
  | { ok: true; upvotes: number | null; persisted: boolean }
  | { ok: false; error: string };

// Atomically bump a review's upvote counter. In preview mode we can't know the
// authoritative count, so we return `upvotes: null` and let the client apply its
// own optimistic +1.
export async function upvoteReview(reviewId: string): Promise<UpvoteResult> {
  if (!supabase) return { ok: true, upvotes: null, persisted: false };
  try {
    const { data, error } = await supabase.rpc("increment_review_upvotes", {
      p_review_id: reviewId,
    });
    if (error) return { ok: false, error: "Couldn't record your upvote." };
    revalidatePath(PATH);
    return { ok: true, upvotes: typeof data === "number" ? data : null, persisted: true };
  } catch {
    return { ok: false, error: "Couldn't record your upvote." };
  }
}

export type AddReplyResult =
  | { ok: true; reply: Reply; persisted: boolean }
  | { ok: false; error: string };

export async function addReply(input: {
  reviewId: string;
  author: string;
  body: string;
}): Promise<AddReplyResult> {
  const author = clean(input.author ?? "", 60);
  const body = clean(input.body ?? "", 600);

  if (!author) return { ok: false, error: "Please add your name." };
  if (body.length < 2) return { ok: false, error: "Your reply is a little short." };

  const reply: Reply = {
    id: randomUUID(),
    reviewId: input.reviewId,
    author,
    body,
    createdAt: today(),
  };

  if (!supabase) return { ok: true, reply, persisted: false };

  try {
    const { data, error } = await supabase
      .from("review_replies")
      .insert({ review_id: input.reviewId, author, body })
      .select("id, created_at")
      .single();
    if (error || !data) return { ok: false, error: "Couldn't post your reply — try again." };
    reply.id = data.id;
    reply.createdAt = String(data.created_at).slice(0, 10);
    revalidatePath(PATH);
    return { ok: true, reply, persisted: true };
  } catch {
    return { ok: false, error: "Couldn't post your reply — try again." };
  }
}
