import type { ImgHTMLAttributes } from "react";
import { adjustStyle, parseAdjust } from "../../lib/imageAdjust";

/**
 * A picture shown the way its owner positioned it (see lib/imageAdjust.ts). Its parent must have a fixed shape and
 * `overflow: hidden` (every frame in the site already does); the image then fills it.
 */
export function AdjustedImg({ adjust, style, alt = "", ...rest }: ImgHTMLAttributes<HTMLImageElement> & { adjust?: string | null }) {
  return <img loading="lazy" decoding="async" referrerPolicy="no-referrer" alt={alt} {...rest} style={{ width: "100%", height: "100%", display: "block", ...adjustStyle(parseAdjust(adjust)), ...style }} />;
}
