import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll-reveal: adds `.in` to every [data-reveal] element the first time
 * it enters the viewport. One IntersectionObserver for the whole app —
 * mount <RevealController /> once. Re-scans on route change and when the
 * DOM gains new [data-reveal] nodes (async-loaded notices, faculty, etc).
 */
export function useRevealScan() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );

    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (reduce) el.classList.add("in");
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
