import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll-reveal: adds `.in` to every [data-reveal] element the first time
 * it enters the viewport. One IntersectionObserver for the whole app —
 * mount <RevealController /> once. Re-scans on route change and when the
 * DOM gains new [data-reveal] nodes (async-loaded notices, faculty, etc).
 */
/**
 * `.in` is a class, and React rewrites `className` whenever a component's own
 * classes change (e.g. an FAQ item getting `is-open`). That silently dropped `.in`
 * and made the element invisible again. A data attribute is never touched by React,
 * so the revealed state survives re-renders; the class is kept for older CSS.
 */
function markIn(el: Element) {
  el.setAttribute("data-in", "");
  el.classList.add("in");
}

export function useRevealScan() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            markIn(e.target);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-in])").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (reduce) markIn(el);
        else io.observe(el);
      });
    };

    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);
}

export function RevealController() {
  useRevealScan();
  return null;
}
