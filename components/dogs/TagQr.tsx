"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Renders the printable "tag" for a dog: a QR code pointing at the public
// profile URL, the human-readable tag code, and the URL itself. This is what a
// physical tag would carry (Phase 2 builds the lookup; ordering physical tags
// is intentionally out of scope for now).
export default function TagQr({ slug, tagCode }: { slug: string; tagCode: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      window.location.origin;
    const profileUrl = `${base}/dog/${slug}`;
    setUrl(profileUrl);
    QRCode.toDataURL(profileUrl, { margin: 1, width: 220 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [slug]);

  return (
    <div className="flex flex-col items-center gap-2 border-2 border-black bg-white p-3">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`QR code for ${slug}`} width={180} height={180} />
      ) : (
        <div className="flex h-[180px] w-[180px] items-center justify-center text-xs text-black/40">
          Generating…
        </div>
      )}
      <p className="text-center text-xs font-bold uppercase tracking-wide text-black/60">
        Tag code
      </p>
      <p className="select-all border-2 border-black bg-[var(--gold)] px-3 py-1 font-mono text-lg font-black tracking-widest">
        {tagCode}
      </p>
      {url && (
        <p className="max-w-[220px] break-all text-center text-[10px] text-black/40">
          {url}
        </p>
      )}
    </div>
  );
}
