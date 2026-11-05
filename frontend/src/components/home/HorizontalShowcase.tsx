import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ICONS } from "../site/icons";
import { fxOn, useScrollProgress } from "./scroll";

export interface ShowItem { to: string; label: string; desc: string }

/**
 * "Explore the school" as a pinned gallery: while you scroll down, the cards glide sideways and the card nearest the
 * middle of the screen lifts and straightens (phones and desktops alike). With reduced motion it is a normal swipeable row.
 */
export function HorizontalShowcase({ items }: { items: ShowItem[] }) {
  const [pinned, setPinned] = useState(fxOn);
  const track = useRef<HTMLDivElement>(null);
  const geo = useRef({ centers: [] as number[], pitch: 300, dist: 0, vw: 0 });
  const ref = useScrollProgress<HTMLElement>("track", (p) => {
    const t = track.current;
    if (!t || !pinned) return;
    const { centers, pitch, dist, vw } = geo.current;
    const shift = p * dist;
    for (let i = 0; i < t.children.length; i++) {
      // how many card-widths this card sits away from the middle of the screen (0 = centred)
      const k = (centers[i] - shift - vw / 2) / pitch;
      (t.children[i] as HTMLElement).style.setProperty("--k", k.toFixed(3));
    }
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPinned(fxOn());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Pinned: the section is one screen + the sideways distance tall (see home.css: height = 100svh + --dist).
  useEffect(() => {
    const section = ref.current;
    const t = track.current;
    if (!section || !t) return;
    if (!pinned) {
      section.style.removeProperty("--dist");
      return;
    }
    const measure = () => {
      const vw = document.documentElement.clientWidth;
      const dist = Math.max(0, Math.round(t.scrollWidth - vw));
      const cards = Array.from(t.children) as HTMLElement[];
      const centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
      geo.current = { centers, pitch: centers.length > 1 ? Math.max(1, centers[1] - centers[0]) : 300, dist, vw };
      section.style.setProperty("--dist", `${dist}px`);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(t);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [pinned, items.length, ref]);

  return (
    <section className={`hs${pinned ? " pinned" : ""}`} ref={ref} aria-label="Explore the school">
      <div className="hs-stage">
        <div className="wrap hs-head" data-reveal>
          <div className="eyebrow">Explore the school</div>
          <h2>Everything in one place.</h2>
          <p className="lede">Each page has its own address, so you can bookmark and share exactly what you need.</p>
        </div>
        <div className="hs-viewport">
          <div className="hs-track" ref={track}>
            {items.map((n, i) => (
              <Link key={n.to} to={n.to} className="hs-card" style={{ ["--i" as string]: i }}>
                <span className="hs-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="f-icon">{ICONS[n.to] ?? ICONS["/about"]}</span>
                <h3>{n.label}</h3>
                <p>{n.desc}</p>
                <span className="go">Open <i aria-hidden="true">→</i></span>
              </Link>
            ))}
          </div>
        </div>
        {pinned && <div className="hs-bar" aria-hidden="true"><i /></div>}
      </div>
    </section>
  );
}
