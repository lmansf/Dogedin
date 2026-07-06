import { getInstagramPosts } from "@/lib/instagram";

// Server component: renders the latest Instagram posts when the Graph API is
// configured, otherwise a "follow us" card. Post images come straight from the
// Instagram CDN (variable hostnames), so a plain <img> is used rather than
// next/image to avoid pinning CDN domains.
export default async function InstagramFeed() {
  const posts = await getInstagramPosts();
  const handle = process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE;

  // Not configured at all -> render nothing. Setup instructions belong in the
  // docs, never on the live page (and an unconfigured feed shouldn't hold
  // homepage real estate as a placeholder).
  if ((!posts || posts.length === 0) && !handle) return null;

  return (
    <section className="border-[3px] border-black bg-white p-5 shadow-hard-lg sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold">📸 From the pack</h2>
        {handle && (
          <a
            href={`https://instagram.com/${handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-black bg-[var(--coral)] px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-hard"
          >
            @{handle}
          </a>
        )}
      </div>

      {posts && posts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {posts.map((post) => (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden border-2 border-black bg-zinc-100"
              title={post.caption ?? "View on Instagram"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.mediaUrl}
                alt={post.caption?.slice(0, 80) ?? "Instagram post"}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              {post.isVideo && (
                <span className="absolute right-1 top-1 text-sm">▶️</span>
              )}
            </a>
          ))}
        </div>
      ) : (
        <div className="border-[3px] border-dashed border-black/30 p-6 text-center">
          <p className="text-sm font-bold text-black/60">
            Follow{" "}
            <a
              href={`https://instagram.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-black underline"
            >
              @{handle}
            </a>{" "}
            for the latest good dogs.
          </p>
        </div>
      )}
    </section>
  );
}
