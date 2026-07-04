// Renders a schema.org JSON-LD block. Server component — the data is built
// at render time from the same sources the page displays (see lib/seo.ts).
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output; `<` is escaped so user-sourced strings (bios,
      // business descriptions) can't break out of the script element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
