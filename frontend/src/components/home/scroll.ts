import { useEffect, useRef } from "react";

/* ═════════════════════════════════════════════════════════════════════════════════════════════════
   Scroll engine — ONE shared loop for every scroll-driven section (landing page, developer page).

   What it does, in plain words
   • Reads the scroll position once per frame (never asks the browser to re-measure the layout while you scroll).
   • Turns it into a number from 0 to 1 for each section and writes it into that section's `--p` CSS variable.
   • The number is DAMPED (it glides to the real value instead of jumping), so wheel steps, finger flicks and
     jittery touch scrolling all look like one smooth, floating motion — the same on phone and desktop.
   • Sections that are far off-screen cost nothing. When nothing is moving, the loop stops (no idle battery use).
   • `html[data-fx]` is set whenever motion is allowed (every device), `html[data-touch]` on touch screens.
     With "reduce motion" switched on, nothing moves at all.
   ═════════════════════════════════════════════════════════════════════════════════════════════════ */

type Kind = "track" | "view" | "exit" | "page";

interface Item {
  el: HTMLElement;
  kind: Kind;
  cb?: (p: number) => void;
  vel: boolean;
  top: number; // distance from the top of the page
  h: number; // own height
  len: number; // "track": scroll distance while pinned; "page": whole page scroll distance
  target: number;
  cur: number;
  shown: number;
  on: boolean;
}

const items = new Set<Item>();
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const media = (q: string) => typeof window !== "undefined" && window.matchMedia(q).matches;

export const reducedMotion = () => media("(prefers-reduced-motion: reduce)");
export const isTouch = () => media("(hover: none), (pointer: coarse)");
/** True when scroll effects may run (every device, unless the person asked for less motion). */
export const fxOn = () => typeof window !== "undefined" && !reducedMotion();
/** Kept for older imports: the pinned gallery now works everywhere effects are allowed. */
export const canPin = fxOn;

/* ───────── measuring (only when the layout changes — never while scrolling) ───────── */
function measure(it: Item) {
  const root = document.documentElement;
  if (it.kind === "page") {
    it.top = 0;
    it.h = root.scrollHeight;
    it.len = Math.max(1, root.scrollHeight - window.innerHeight);
    return;
  }
  const r = it.el.getBoundingClientRect();
  it.top = r.top + window.scrollY;
  it.h = r.height;
  if (it.kind === "track") {
    const stage = it.el.firstElementChild as HTMLElement | null; // the sticky stage is always the first child
    it.len = Math.max(1, it.h - (stage?.offsetHeight ?? window.innerHeight));
  }
}

function targetOf(it: Item, y: number, vh: number): number {
  switch (it.kind) {
    case "track":
      return clamp((y - it.top) / it.len);
    case "view":
      return clamp((y + vh - it.top) / (vh + it.h));
    case "exit":
      return clamp((y - it.top) / Math.max(1, it.h));
    default:
      return clamp(y / it.len);
  }
}

/* ───────── the loop ───────── */
let raf = 0;
let lastT = 0;
let lastY = 0;
let lastScrollAt = 0;
let vel = 0; // scroll speed, -1 … 1, smoothed
let remeasure = false;
let running = false;
let ro: ResizeObserver | null = null;

function write(it: Item, force = false) {
  if (force || Math.abs(it.cur - it.shown) >= 0.0004) {
    it.shown = it.cur;
    it.el.style.setProperty("--p", it.cur.toFixed(4));
    it.cb?.(it.cur);
  }
  if (it.vel) it.el.style.setProperty("--v", vel.toFixed(3));
}

function frame(now: number) {
  raf = 0;
  if (!items.size) return;
  const dt = clamp((now - lastT) / 1000, 0.001, 0.064);
  lastT = now;

  if (remeasure) {
    remeasure = false;
    items.forEach(measure);
  }

  const y = window.scrollY;
  const vh = window.innerHeight;
  const speed = (y - lastY) / dt;
  lastY = y;
  vel += (clamp(speed / 2600, -1, 1) - vel) * (1 - Math.exp(-dt / 0.12));
  if (Math.abs(vel) < 0.002) vel = 0;

  // Touch already has its own momentum, so it needs less smoothing than a stepped mouse wheel.
  const k = 1 - Math.exp(-dt / (isTouch() ? 0.07 : 0.1));
  let busy = vel !== 0;

  items.forEach((it) => {
    const t = targetOf(it, y, vh);
    it.target = t;
    const near = it.kind === "page" || (y + vh * 1.6 > it.top && y - vh * 0.6 < it.top + it.h);
    if (!near) {
      if (it.on) {
        it.on = false;
        it.cur = t;
        write(it, true);
      }
      return;
    }
    if (!it.on) {
      it.on = true; // just came close: start exactly where it should be (no glide from an old value)
      it.cur = t;
    } else {
      const d = t - it.cur;
      it.cur = Math.abs(d) < 0.0004 ? t : it.cur + d * k;
    }
    if (it.cur !== t) busy = true;
    write(it);
  });

  if (busy || now - lastScrollAt < 160) raf = requestAnimationFrame(frame);
}

function wake() {
  if (!raf && items.size && running) {
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }
}
const onScroll = () => {
  lastScrollAt = performance.now();
  wake();
};
const onResize = () => {
  remeasure = true;
  wake();
};

function start() {
  if (running) return;
  running = true;
  lastY = window.scrollY;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  window.addEventListener("load", onResize);
  document.fonts?.ready.then(onResize).catch(() => {});
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(onResize); // the page growing/shrinking (images, fonts, data arriving) re-measures everything
    ro.observe(document.body);
  }
}
function stop() {
  if (!running) return;
  running = false;
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("orientationchange", onResize);
  window.removeEventListener("load", onResize);
  ro?.disconnect();
  ro = null;
  cancelAnimationFrame(raf);
  raf = 0;
}

/** Start following one element. Returns the function that stops following it. */
function watch(el: HTMLElement, kind: Kind, cb: ((p: number) => void) | undefined, wantVel: boolean): () => void {
  if (reducedMotion()) {
    // Nothing moves: park the number in the middle (or the start) and stay there.
    el.style.setProperty("--p", kind === "view" ? "0.5" : "0");
    if (wantVel) el.style.setProperty("--v", "0");
    cb?.(0);
    return () => {};
  }
  const it: Item = { el, kind, cb, vel: wantVel, top: 0, h: 0, len: 1, target: 0, cur: 0, shown: -1, on: true };
  items.add(it);
  start();
  measure(it);
  it.target = it.cur = targetOf(it, window.scrollY, window.innerHeight);
  write(it, true);
  ro?.observe(el); // this section changing size (e.g. the gallery getting its height) re-measures too
  wake();
  return () => {
    items.delete(it);
    ro?.unobserve(el);
    if (!items.size) stop();
  };
}

/**
 * Writes the element's scroll progress (0 → 1) into its `--p` CSS variable — no React re-render.
 *   "track": the element is TALL and holds a sticky stage (its first child); 0 when it reaches the top, 1 at its end.
 *   "view" : 0 when it starts entering from the bottom, 1 when it has fully left through the top.
 *   "exit" : 0 while its top is at/below the top of the screen, 1 when it has scrolled completely away.
 *   "page" : the whole page, 0 at the top → 1 at the bottom (the thin progress line).
 * `onChange` (optional) receives every new value. `{ velocity: true }` also keeps `--v` (scroll speed, -1…1) up to date.
 */
export function useScrollProgress<T extends HTMLElement>(kind: Kind, onChange?: (p: number) => void, opts?: { velocity?: boolean }) {
  const ref = useRef<T>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const wantVel = !!opts?.velocity;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return watch(el, kind, (p) => cb.current?.(p), wantVel);
  }, [kind, wantVel]);
  return ref;
}

/* ───────── html[data-fx] / html[data-touch] ───────── */
if (typeof window !== "undefined") {
  const apply = () => {
    const root = document.documentElement;
    root.toggleAttribute("data-fx", fxOn());
    root.toggleAttribute("data-touch", isTouch());
  };
  apply();
  for (const q of ["(prefers-reduced-motion: reduce)", "(hover: none), (pointer: coarse)"]) window.matchMedia(q).addEventListener("change", apply);
}
