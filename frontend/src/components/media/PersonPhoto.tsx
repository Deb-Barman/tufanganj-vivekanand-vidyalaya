import { useState } from "react";
import { AdjustedImg } from "./AdjustedImg";
import { openLightbox } from "./lightboxStore";
import "./person-photo.css";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * A round profile picture (or the person's initials when there is none). Tapping a real picture opens it full screen,
 * so everyone can see the whole picture — students and teachers, on the website and in the portal.
 */
export function PersonPhoto({ name, src, adjust, size = 56, zoomable = true, className = "" }: { name: string; src?: string | null; adjust?: string | null; size?: number; zoomable?: boolean; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const style = { width: size, height: size, fontSize: size * 0.36 };
  if (!src || failed === src) {
    return <span className={`ph ph-initials ${className}`} style={style} aria-hidden="true">{initials(name)}</span>;
  }
  const img = <AdjustedImg src={src} adjust={adjust} alt={zoomable ? "" : `${name}'s photo`} loading="eager" onError={() => setFailed(src)} />;
  if (!zoomable) return <span className={`ph ${className}`} style={style}>{img}</span>;
  return (
    <button type="button" className={`ph ph-btn ${className}`} style={style} onClick={(e) => { e.preventDefault(); e.stopPropagation(); openLightbox({ src, alt: `${name}'s photo`, caption: name }); }} aria-label={`View ${name}'s photo full screen`}>
      {img}
    </button>
  );
}
