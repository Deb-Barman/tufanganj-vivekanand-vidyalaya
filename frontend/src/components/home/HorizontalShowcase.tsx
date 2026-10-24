import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ICONS } from "../site/icons";
import { canPin, useScrollProgress } from "./scroll";

export interface ShowItem { to: string; label: string; desc: string }

/**
 * "Explore the school" as a pinned gallery: on a desktop the cards slide sideways while you scroll down;
 * on phones/tablets (and with reduced motion) it is a normal swipeable row.
 */
export function HorizontalShowcase({ items }: { items: ShowItem[] }) {
  const [pinned, setPinned] = useState(canPin);
  const track = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>();
  const ref = useScrollProgress<HTMLElement>("track");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px) and (hover: hover)");
    const onChange = () => setPinned(canPin());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Pinned: the section is as tall as the sideways distance + one screen.
  useEffect(() => {
    if (!pinned) {
      // oxlint-disable-next-line react/set-state-in-effect
      setHeight(undefined);
      return;
    }
    const measure = () => {
      const t = track.current;
      if (!t) return;
      const dist = Math.max(0, t.scrollWidth - window.innerWidth + 120);
      t.style.setProperty("--dist", `${dist}px`);
      setHeight(window.innerHeight + dist);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pinned, items.length]);

  return (
    <section className={`hs${pinned ? " pinned" : ""}`} ref={ref} style={height ? { height } : undefined} aria-label="Explore the school">
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
