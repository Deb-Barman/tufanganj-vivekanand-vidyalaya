import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { closeLightbox, getLightbox, subscribeLightbox } from "./lightboxStore";
import type { LightboxItem } from "./lightboxStore";
import "./lightbox.css";

export function LightboxRoot() {
  const st = useSyncExternalStore(subscribeLightbox, getLightbox, () => null);
  if (!st) return null;
  return createPortal(<Viewer key={st.items[0].src} items={st.items} start={st.index} />, document.body);
}

function Viewer({ items, start }: { items: LightboxItem[]; start: number }) {
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [broken, setBroken] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const many = items.length > 1;
  const item = items[index];

  const go = useCallback((d: number) => {
    setIndex((i) => (i + d + items.length) % items.length);
    setZoomed(false);
    setBroken(false);
  }, [items.length]);

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
      if (e.key === "Escape") closeLightbox();
      else if (many && e.key === "ArrowRight") go(1);
      else if (many && e.key === "ArrowLeft") go(-1);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [go, many]);

  // when zooming in, start in the middle of the big picture
  useEffect(() => {
    const el = stageRef.current;
    if (zoomed && el) {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    }
  }, [zoomed]);

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="lb-top">
        <span className="lb-count">{many ? `${index + 1} / ${items.length}` : ""}</span>
        <div className="lb-tools">
          <button type="button" className="lb-btn" onClick={() => setZoomed((z) => !z)} aria-pressed={zoomed} aria-label={zoomed ? "Fit to screen" : "Zoom in"}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M8 11h6" />{!zoomed && <path d="M11 8v6" />}</svg>
          </button>
          <a className="lb-btn" href={item.src} target="_blank" rel="noopener noreferrer" aria-label="Open the original picture in a new tab">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
          </a>
          <button ref={closeRef} type="button" className="lb-btn" onClick={closeLightbox} aria-label="Close">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`lb-stage${zoomed ? " zoomed" : ""}`}
        onClick={(e) => e.target === e.currentTarget && closeLightbox()}
        onTouchStart={(e) => { touchX.current = zoomed ? null : e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null || !many) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {broken ? (
          <p className="lb-broken">This picture could not be loaded. <a href={item.src} target="_blank" rel="noopener noreferrer">Open it in a new tab</a></p>
        ) : (
          <img className="lb-img" src={item.src} alt={item.alt ?? ""} referrerPolicy="no-referrer" draggable={false} onClick={() => setZoomed((z) => !z)} onError={() => setBroken(true)} />
        )}
      </div>

      {item.caption && <p className="lb-cap">{item.caption}</p>}
      {many && !zoomed && (
        <>
          <button type="button" className="lb-nav prev" onClick={() => go(-1)} aria-label="Previous picture">‹</button>
          <button type="button" className="lb-nav next" onClick={() => go(1)} aria-label="Next picture">›</button>
        </>
      )}
    </div>
  );
}
