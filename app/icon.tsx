import { ImageResponse } from "next/og";

// Favicon: the paw mark on highland gold, generated at build time. Same
// self-contained drawing as app/opengraph-image.tsx — no external fetches.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const INK = "#211e18";
const GOLD = "#c99a2e";

export default function Icon() {
  const toe = (left: number, top: number, s: number) => (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: s,
        height: s * 1.25,
        borderRadius: "50%",
        backgroundColor: INK,
      }}
    />
  );
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: GOLD,
          border: `4px solid ${INK}`,
          position: "relative",
        }}
      >
        {toe(6, 20, 12)}
        {toe(19, 9, 13)}
        {toe(34, 9, 13)}
        {toe(48, 20, 12)}
        <div
          style={{
            position: "absolute",
            left: 17,
            top: 27,
            width: 32,
            height: 26,
            borderRadius: "50% 50% 46% 46%",
            backgroundColor: INK,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
