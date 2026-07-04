import { ImageResponse } from "next/og";

// Default Open Graph card, generated at build time from the site palette
// (app/globals.css). Deliberately self-contained: the paw is drawn with
// positioned divs and the text uses next/og's bundled font, so rendering
// never fetches emoji sheets or webfonts from a CDN.
export const alt = "Dogedin — Dunedin, FL's club for dog lovers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#211e18";
const SAND = "#f4e9ce";
const GREEN = "#1f5c4a";
const GOLD = "#c99a2e";
const RED = "#a6332e";
const TURQ = "#1fa89b";

// A paw print: one pad + four toes, absolutely positioned. `scale` keeps the
// same proportions usable for the big OG mark and the small favicon.
function Paw({ scale = 1, color = INK }: { scale?: number; color?: string }) {
  const toe = (left: number, top: number, s: number) => (
    <div
      style={{
        position: "absolute",
        left: left * scale,
        top: top * scale,
        width: s * scale,
        height: s * scale * 1.25,
        borderRadius: "50%",
        backgroundColor: color,
      }}
    />
  );
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: 120 * scale,
        height: 110 * scale,
      }}
    >
      {toe(2, 28, 26)}
      {toe(30, 4, 28)}
      {toe(62, 4, 28)}
      {toe(92, 28, 26)}
      <div
        style={{
          position: "absolute",
          left: 26 * scale,
          top: 44 * scale,
          width: 68 * scale,
          height: 58 * scale,
          borderRadius: "50% 50% 46% 46%",
          backgroundColor: color,
        }}
      />
    </div>
  );
}

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: SAND,
          border: `14px solid ${INK}`,
        }}
      >
        {/* Tartan-inspired ribbon */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: 36,
            backgroundColor: GREEN,
          }}
        >
          <div style={{ height: 8, backgroundColor: RED, marginTop: 8 }} />
          <div style={{ height: 6, backgroundColor: GOLD, marginTop: 6 }} />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "0 80px",
          }}
        >
          {/* Gold sticker wordmark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              backgroundColor: GOLD,
              border: `10px solid ${INK}`,
              boxShadow: `14px 14px 0 ${INK}`,
              padding: "18px 48px",
              transform: "rotate(-2deg)",
            }}
          >
            <Paw scale={0.9} />
            <div
              style={{
                fontSize: 132,
                fontWeight: 700,
                color: INK,
                letterSpacing: -4,
              }}
            >
              Dogedin
            </div>
          </div>

          <div
            style={{
              marginTop: 56,
              fontSize: 44,
              fontWeight: 700,
              color: INK,
            }}
          >
            Dunedin, FL&apos;s club for dog lovers
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 30,
              fontWeight: 700,
              color: GREEN,
            }}
          >
            Dogedin · Dunedin, FL dog community
          </div>
        </div>

        {/* Gulf-coast footer stripe */}
        <div style={{ display: "flex", height: 26, backgroundColor: TURQ }} />
      </div>
    ),
    { ...size }
  );
}
