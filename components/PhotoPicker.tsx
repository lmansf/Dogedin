"use client";

import { useEffect, useRef, useState } from "react";

// Shared "choose a photo" control for every upload form (share-a-photo,
// registration, business submission). The native file input is visually
// hidden and the wrapping <label> is styled like the site's buttons, so the
// control reads as "📷 Choose a photo" instead of the browser's default
// chrome. Shows the chosen filename and a local object-URL preview.
//
// Validation stays with the caller: `onPick` receives the raw File (or null)
// and each form keeps its own type/size checks. When the caller rejects or
// clears the file (file prop back to null), the native input is reset too,
// so the control never claims a file the form didn't accept.
export default function PhotoPicker({
  file,
  onPick,
  accept,
  emptyIcon = "🐶",
  previewClassName = "h-20 w-20",
}: {
  file: File | null;
  onPick: (file: File | null) => void;
  accept: string;
  emptyIcon?: string;
  previewClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      // Keep the hidden input honest when the caller clears/rejects the file.
      if (inputRef.current) inputRef.current.value = "";
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className={`relative shrink-0 overflow-hidden border-2 border-black bg-zinc-100 ${previewClassName}`}
      >
        {preview ? (
          // Local object URL preview — plain img is correct here (not a
          // remote/optimizable source).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-3xl">{emptyIcon}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <label className="cursor-pointer border-[3px] border-black bg-[var(--sand)] px-4 py-2 text-xs font-black uppercase tracking-wide shadow-hard transition-transform hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-[var(--turq)]">
          📷 {file ? "Change photo" : "Choose a photo"}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
        <span className="max-w-full truncate text-xs font-semibold text-black/50">
          {file ? file.name : "No photo chosen yet"}
        </span>
      </div>
    </div>
  );
}
