import type { CSSProperties } from "react";

/**
 * Where a picture sits inside its frame — like moving and zooming a photo in Instagram.
 * Saved as the short text "x,y,zoom" (x and y are percent of the picture, zoom is 1–4). The original picture is
 * never cut: pages only change how it is shown, so it works the same for uploads and for pasted links.
 */
export interface Adjust {
  x: number;
  y: number;
  z: number;
}

export const DEFAULT_ADJUST: Adjust = { x: 50, y: 50, z: 1 };
export const MAX_ZOOM = 4;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function parseAdjust(text?: string | null): Adjust {
  if (!text) return DEFAULT_ADJUST;
  const [x, y, z] = text.split(",").map((p) => Number.parseFloat(p));
  if (![x, y, z].every(Number.isFinite)) return DEFAULT_ADJUST;
  return { x: clamp(x, 0, 100), y: clamp(y, 0, 100), z: clamp(z, 1, MAX_ZOOM) };
}

const r2 = (n: number) => String(Math.round(n * 100) / 100);

/** "" when the picture is simply centred (nothing to save). */
export function formatAdjust(a: Adjust): string {
  if (Math.abs(a.x - 50) < 0.05 && Math.abs(a.y - 50) < 0.05 && Math.abs(a.z - 1) < 0.005) return "";
  return `${r2(a.x)},${r2(a.y)},${r2(clamp(a.z, 1, MAX_ZOOM))}`;
}

export function adjustStyle(a: Adjust): CSSProperties {
  const origin = `${a.x}% ${a.y}%`;
  return { objectFit: "cover", objectPosition: origin, transformOrigin: origin, transform: a.z > 1.001 ? `scale(${a.z})` : undefined };
}

/** The shapes a picture can be framed in (what the adjuster previews). */
export type AdjustShape = "circle" | "square" | "wide" | "card" | "photo";
