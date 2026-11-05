import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShellSkeleton } from "../../portal/ui/Skeletons";
import "./loading.css";

/* ── Simple spinner (buttons, tiny areas) ── */
export function Spinner({ size = "md", label }: { size?: "md" | "lg"; label?: string }) {
  return (
    <span role="status" aria-label={label ?? "Loading"} style={{ display: "inline-flex", alignItems: "center" }}>
      <span className={`spinner ${size === "lg" ? "lg" : ""}`} />
    </span>
  );
}

export function SpinCenter({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="spin-center" role="status">
      <span className="spinner lg" />
      {text}
    </div>
  );
}

/* ── Skeleton primitives ── */
export function Sk({ w = "100%", h, className = "", circle = false, style }: { w?: number | string; h?: number | string; className?: string; circle?: boolean; style?: React.CSSProperties }) {
  return <span className={`sk ${circle ? "sk-circle" : ""} ${className}`} style={{ display: "block", width: w, height: h, ...style }} aria-hidden="true" />;
}

/** Cards with an image area and two text lines — blog, gallery, achievements. */
export function SkCards({ count = 6, image = true }: { count?: number; image?: boolean }) {
  return (
    <div className="sk-grid" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-card" key={i}>
          {image && <Sk h={140} className="sk-box" />}
          <Sk h={16} w="80%" className="sk-line lg" />
          <Sk h={11} className="sk-line sm" />
          <Sk h={11} w="64%" className="sk-line sm" />
        </div>
      ))}
    </div>
  );
}

/** Same grid and card shape as the real teacher cards, so nothing jumps when data arrives. */
export function SkTeachers({ count = 6 }: { count?: number }) {
  return (
    <div className="card-grid" aria-busy="true" aria-label="Loading teachers">
      {Array.from({ length: count }, (_, i) => (
        <div className="feature sk-teacher" key={i}>
          <Sk w={58} h={58} circle />
          <Sk h={20} w={`${72 - (i % 3) * 8}%`} className="sk-line lg" />
          <Sk h={26} w={96} className="sk-line" style={{ borderRadius: 999 }} />
          <Sk h={11} w="52%" className="sk-line sm" />
          <Sk h={11} className="sk-line sm" />
          <Sk h={11} w="78%" className="sk-line sm" />
        </div>
      ))}
    </div>
  );
}

/** Avatar + lines rows — faculty, notices, people. */
export function SkList({ count = 5, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <div className="sk-list" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-card sk-row" key={i}>
          {avatar ? <Sk w={48} h={48} circle /> : <Sk w={58} h={58} className="sk-box" />}
          <div className="sk-col">
            <Sk h={16} w={`${70 - (i % 3) * 10}%`} className="sk-line" />
            <Sk h={10} w={`${92 - (i % 4) * 8}%`} className="sk-line sm" />
            {!avatar && <Sk h={10} w="64%" className="sk-line sm" />}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Same shape as a real notice row (date badge, title, two lines, meta) — compact, so nothing jumps when the notices arrive. */
export function SkNotices({ count = 4 }: { count?: number }) {
  return (
    <div className="sk-notices" aria-busy="true" aria-label="Loading notices">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-notice" key={i}>
          <Sk w={54} h={58} className="sk-box sk-badge" />
          <div className="sk-col">
            <Sk h={16} w={`${72 - (i % 3) * 9}%`} className="sk-line" />
            <Sk h={10} className="sk-line sm" />
            <Sk h={10} w={`${84 - (i % 4) * 8}%`} className="sk-line sm" />
            <div className="sk-meta"><Sk w={96} h={9} className="sk-line sm" />{i % 2 === 0 && <Sk w={62} h={18} className="sk-line" style={{ borderRadius: 999 }} />}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Same shape as a real `.row-card` row (Events, Downloads). It uses the real classes (row-list, row-card, date-badge, row-body),
 * so the padding, badge and text sizes match the real rows on every screen — nothing jumps when the data arrives.
 *   "event": date badge, title, two text lines, date + pill.   "file": file badge, title, "Added…" line, two buttons.
 */
export function SkRowCards({ count = 4, variant = "event" }: { count?: number; variant?: "event" | "file" }) {
  return (
    <div className="row-list sk-rowcards" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: count }, (_, i) => (
        <div className="row-card" key={i}>
          <span className="date-badge sk" aria-hidden="true" />
          <div className="row-body">
            <Sk h={20} w={`${68 - (i % 3) * 9}%`} className="sk-line" />
            {variant === "event" ? (
              <>
                <Sk h={12} className="sk-line sm" />
                <Sk h={12} w={`${74 - (i % 4) * 8}%`} className="sk-line sm" />
                <div className="sk-meta"><Sk w={104} h={11} className="sk-line sm" />{i % 2 === 0 && <Sk w={52} h={20} className="sk-line" style={{ borderRadius: 999 }} />}</div>
              </>
            ) : (
              <Sk w={140} h={11} className="sk-line sm" style={{ marginTop: 4 }} />
            )}
          </div>
          {variant === "file" && (
            <div className="sk-actions" aria-hidden="true">
              <Sk w={66} h={36} className="sk-line" style={{ borderRadius: 999 }} />
              <Sk w={94} h={36} className="sk-line" style={{ borderRadius: 999 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Same shape as a real achievement card (small picture, pill, title, two lines). */
export function SkAchievements({ count = 6 }: { count?: number }) {
  return (
    <div className="sk-ach" aria-busy="true" aria-label="Loading achievements">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-ach-card" key={i}>
          <Sk w={84} h={84} className="sk-box" />
          <div className="sk-col">
            <Sk w={84} h={16} className="sk-line" style={{ borderRadius: 999 }} />
            <Sk h={15} w={`${78 - (i % 3) * 10}%`} className="sk-line" />
            <Sk h={10} className="sk-line sm" />
            <Sk h={10} w="62%" className="sk-line sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A full article: title, byline, paragraphs. */
export function SkArticle() {
  return (
    <div className="sk-list" aria-busy="true" aria-label="Loading article" style={{ maxWidth: 760 }}>
      <Sk h={38} w="85%" className="sk-line xl" />
      <Sk h={12} w="40%" className="sk-line sm" />
      <Sk h={220} className="sk-box" />
      {Array.from({ length: 6 }, (_, i) => (
        <Sk key={i} h={12} w={i % 3 === 2 ? "70%" : "100%"} className="sk-line" />
      ))}
    </div>
  );
}

/** Whole-page placeholder: used while a page's code loads (Suspense). */
export function PageSkeleton() {
  return (
    <div className="wrap sk-page" aria-busy="true" aria-label="Loading page">
      <div className="sk-hero">
        <Sk h={12} w={120} className="sk-line sm" />
        <Sk h={44} w="75%" className="sk-line xl" />
        <Sk h={14} w="95%" className="sk-line" />
        <Sk h={14} w="70%" className="sk-line" />
      </div>
      <SkCards count={3} />
    </div>
  );
}

/** Dashboard placeholder: sidebar + cards, like a signed-in app shell. */
/** Whole-dashboard placeholder (sidebar / top bar / hero / tiles) — see portal/ui/Skeletons. */
export function DashboardSkeleton() {
  return <ShellSkeleton />;
}

/**
 * Thin top progress bar. Runs on every page change, and while a lazily-loaded
 * page is still downloading (the Suspense fallback renders <ProgressBusy />).
 */
export function RouteProgress() {
  const { pathname } = useLocation();
  const [state, setState] = useState<"idle" | "run" | "done">("idle");
  const [width, setWidth] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let t2 = 0;
    let t3 = 0;
    const t1 = window.setTimeout(() => {
      setState("run");
      setWidth(35);
      t2 = window.setTimeout(() => setWidth(82), 120);
      t3 = window.setTimeout(() => {
        setWidth(100);
        setState("done");
        window.setTimeout(() => setState("idle"), 400);
      }, 480);
    }, 0);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [pathname]);

  return (
    <div className={`route-progress ${state === "run" ? "on" : state === "done" ? "on" : ""}`} aria-hidden="true">
      <i style={{ width: `${state === "idle" ? 0 : width}%` }} />
    </div>
  );
}

/** Rendered inside Suspense fallbacks so the bar keeps crawling while a page chunk downloads. */
export function ProgressBusy() {
  return (
    <div className="route-progress busy on" aria-hidden="true">
      <i />
    </div>
  );
}

/** Full-screen simple loader for the login pages while their code downloads. */
export function ScreenLoader() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "var(--bg, #0b0c12)" }} role="status" aria-label="Loading">
      <ProgressBusy />
      <span className="spinner lg" />
    </div>
  );
}

/** Content-area skeleton for dashboard pages: header, toolbar and rows (shape of the real page). */
export { ModuleSkeleton } from "../../portal/ui/Skeletons";
