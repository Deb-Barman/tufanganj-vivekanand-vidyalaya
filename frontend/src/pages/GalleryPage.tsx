import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AdjustedImg } from "../components/media/AdjustedImg";
import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkCards } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { GalleryImage } from "../types/api";
import "./GalleryPage.css";

/** Public photo gallery. Photos are uploaded by the Super Admin from Dashboard ▸ Gallery. */
export function GalleryPage() {
  usePageMeta("Gallery", `Photos from school life at ${SITE.nameFull}.`, "/gallery");
  const { data, error, more, hasMore, busy } = usePaged<GalleryImage>("/content/gallery/public/", 24);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <PageHero crumb="Gallery" eyebrow="School life" title="Moments from our school." lede="Photographs from the classroom, the field and school events, added by the school office." />
      <Section>
        {data === null ? (
          <SkCards count={6} />
        ) : data.length === 0 ? (
          <EmptyPanel icon="info" title={error ? "The gallery could not be loaded" : "Photos are coming soon"}>
            {error ?? "New photographs appear here as soon as the school office uploads them."} <Link to="/campus" style={{ color: "var(--accent)", fontWeight: 700 }}>See the campus</Link> in the meantime.
          </EmptyPanel>
        ) : (
          <>
            <ul className="gal-grid">
              {data.map((g, i) => (
                <li key={g.id} data-reveal style={{ ["--d" as string]: i % 4 }}>
                  <button type="button" className="gal-tile" onClick={() => setOpen(i)} aria-label={g.caption ? `Open photo: ${g.caption}` : "Open photo"}>
                    <AdjustedImg src={g.image} adjust={g.image_adjust} alt={g.caption || "Photo from school life at Tufanganj Vivekananda Vidyalaya"} />
                    {g.caption && <span className="gal-cap">{g.caption}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="gal-more">
                <button type="button" className="btn btn-outline" onClick={more} disabled={busy}>
                  {busy ? "Loading…" : "Show more photos"}
                </button>
              </div>
            )}
          </>
        )}
      </Section>
      {data && open !== null && data[open] && <Lightbox items={data} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

function Lightbox({ items, index, onIndex, onClose }: { items: GalleryImage[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const go = useCallback((d: number) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const g = items[index];
  return (
    <div
      className="gal-lb"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <button ref={closeRef} type="button" className="gal-x" onClick={onClose} aria-label="Close photo viewer">✕</button>
      {items.length > 1 && <button type="button" className="gal-nav prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>}
      <figure className="gal-fig">
        <img src={g.image} alt={g.caption || "Photo from school life at Tufanganj Vivekananda Vidyalaya"} referrerPolicy="no-referrer" />
        <figcaption>
          {g.caption && <span>{g.caption} · </span>}
          {index + 1} / {items.length}
        </figcaption>
      </figure>
      {items.length > 1 && <button type="button" className="gal-nav next" onClick={() => go(1)} aria-label="Next photo">›</button>}
    </div>
  );
}
