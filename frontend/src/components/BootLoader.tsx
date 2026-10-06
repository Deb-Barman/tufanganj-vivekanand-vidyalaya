import { useEffect, useState } from "react";
import { SchoolLogo } from "./SchoolLogo";
import "./BootLoader.css";

/**
 * Premium splash. The plain-HTML #boot screen in index.html is what the
 * browser paints instantly; this component takes it over with a richer
 * animated sequence (orbiting rings, crest, progress, tagline), then
 * fades everything out and unmounts.
 *
 * Timing is a *minimum* so the intro always reads as intentional, but it
 * never blocks longer than MAX_MS, and repeat visits in the same tab
 * (sessionStorage) get a much shorter version so it never feels slow.
 */
const MIN_MS_FIRST = 2200;
const MIN_MS_REPEAT = 650;
const MAX_MS = 5000; // hard cap: a stalled network must never trap the visitor on the splash
const FADE_MS = 700;

export function BootLoader() {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  useEffect(() => {
    let repeat = false;
    try {
      repeat = sessionStorage.getItem("tvv-booted") === "1";
      sessionStorage.setItem("tvv-booted", "1");
    } catch {
      /* ignore */
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const min = reduce ? 0 : repeat ? MIN_MS_REPEAT : MIN_MS_FIRST;
    const fade = reduce ? 0 : FADE_MS;

    // Hand over from the static HTML splash immediately.
    document.getElementById("boot")?.remove();
    document.documentElement.classList.add("booting");

    const started = performance.now();
    const timers: number[] = [];
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      const wait = Math.max(0, min - (performance.now() - started));
      timers.push(
        window.setTimeout(() => {
          setPhase("leave");
          document.documentElement.classList.remove("booting");
          timers.push(window.setTimeout(() => setPhase("gone"), fade));
        }, wait)
      );
    };

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    // Safety net: leave even if `load` never fires (slow fonts/images).
    timers.push(window.setTimeout(finish, MAX_MS));

    return () => {
      window.removeEventListener("load", finish);
      timers.forEach(clearTimeout);
      document.documentElement.classList.remove("booting");
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`bootloader ${phase === "leave" ? "leave" : ""}`} role="status" aria-live="polite" aria-label="Loading Tufanganj Vivekananda Vidyalaya">
      <div className="bl-aurora" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div className="bl-grid" aria-hidden="true" />

      <div className="bl-center">
        <div className="bl-emblem" aria-hidden="true">
          <div className="bl-disc">
            <svg viewBox="0 0 160 160">
              <circle className="bl-trk" cx="80" cy="80" r="74" />
              <circle className="bl-prg" cx="80" cy="80" r="74" />
            </svg>
            <span className="bl-logo"><SchoolLogo size={84} /></span>
          </div>
        </div>

        <h1 className="bl-title">
          <span className="bl-line"><span>Tufanganj</span></span>
          <span className="bl-line"><span>Vivekananda <em>Vidyalaya</em></span></span>
        </h1>
        <p className="bl-tag">Est. 1964 &nbsp;·&nbsp; Cooch Behar</p>

        <div className="bl-bar" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}
