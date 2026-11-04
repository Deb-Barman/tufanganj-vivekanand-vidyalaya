import { useEffect, useRef } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll-driven animation is for a DESKTOP with a mouse only. Phones and tablets (even when they show the desktop layout)
 * get calm, normal scrolling. This sets `data-fx` on <html>; the CSS only moves things under `html[data-fx]`.
 */
const FX_QUERY = "(min-width: 900px) and (hover: hover) and (pointer: fine)";
export const fxOn = () => typeof window !== "undefined" && window.matchMedia(FX_QUERY).matches && !reduced();
if (typeof window !== "undefined") {
  const apply = () => document.documentElement.toggleAttribute("data-fx", fxOn());
  apply();
  window.matchMedia(FX_QUERY).addEventListener("change", apply);
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", apply);
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Writes the element's scroll progress (0 → 1) into its `--p` CSS variable — no React re-render, only a style write
 * once per animation frame, so scroll animations stay smooth.
 *   "track": the element is TALL and holds a sticky stage; 0 when its top reaches the top, 1 at its end.
 *   "view" : 0 when it starts entering from the bottom, 1 when it has fully left through the top.
 *   "exit" : 0 while its top is at/below the top of the screen, 1 when it has scrolled completely away.
 * `onChange` (optional) receives every new value — used for things that need React state (e.g. the active chapter).
 */
export function useScrollProgress<T extends HTMLElement>(kind: "track" | "view" | "exit", onChange?: (p: number) => void) {
  const ref = useRef<T>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) {
      el.style.setProperty("--p", kind === "view" ? "0.5" : "0");
      cb.current?.(0);
      return;
    }
    let raf = 0;
    let last = -1;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = kind === "track" ? clamp(-r.top / Math.max(1, r.height - vh)) : kind === "view" ? clamp((vh - r.top) / (vh + r.height)) : clamp(-r.top / Math.max(1, r.height));
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      el.style.setProperty("--p", p.toFixed(4));
      cb.current?.(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [kind]);
  return ref;
}

/** True where the pinned horizontal gallery may be used (desktop mouse only). */
export const canPin = fxOn;
