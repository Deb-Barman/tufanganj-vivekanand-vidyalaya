import { useEffect } from "react";
import { useTheme } from "../lib/theme";
import catalog from "../errors/catalog.json";
import "../styles/error-screen.css";

export type ErrorCode = keyof typeof catalog;

/** Floating gold sparks: fixed values so server/static/React renders are identical. */
const SPARKS = [
  { x: "8%", s: "3px", d: "9s", t: "0.2s" }, { x: "19%", s: "2px", d: "12s", t: "2.4s" }, { x: "31%", s: "4px", d: "10s", t: "4.1s" },
  { x: "43%", s: "2px", d: "13s", t: "1.1s" }, { x: "55%", s: "3px", d: "9.5s", t: "5.6s" }, { x: "66%", s: "2px", d: "11s", t: "3.3s" },
  { x: "77%", s: "4px", d: "12.5s", t: "0.8s" }, { x: "88%", s: "3px", d: "10.5s", t: "6.4s" },
];

/**
 * Full-viewport, never-scrolling error screen (404 in the app, 500 for crashes).
 * Same markup + stylesheet as the static pages in public/errors/ — see
 * scripts/build-error-pages.mjs.
 */
export function ErrorScreen({ code = "404", onRetry }: { code?: ErrorCode; onRetry?: () => void }) {
  const { resolved, setPreference } = useTheme();
  const c = catalog[code];

  useEffect(() => {
    const html = document.documentElement;
    const prevTitle = document.title;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.title = `${code} · ${c.title} | Tufanganj Vivekananda Vidyalaya`;
    return () => {
      html.style.overflow = prevOverflow;
      document.body.style.overflow = "";
      document.title = prevTitle;
    };
  }, [code, c.title]);

  const action = (kind: string, label: string, primary: boolean) => {
    const cls = `e-btn ${primary ? "primary" : "ghost"}`;
    const arrow = (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </svg>
    );
    const refresh = (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4" />
      </svg>
    );
    if (kind === "retry")
      return (
        <button type="button" className={cls} onClick={() => (onRetry ? onRetry() : window.location.reload())}>
          {label} {refresh}
        </button>
      );
    if (kind === "back")
      return (
        <button type="button" className={cls} onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}>
          {label}
        </button>
      );
    return (
      <a className={cls} href={kind === "portal" ? "/portal" : "/"}>
        {label} {primary && arrow}
      </a>
    );
  };

  return (
    <div className="tvv-err" role="main">
      <div className="e-frame">
        <header className="e-head">
          <a className="e-brand" href="/" aria-label="Tufanganj Vivekananda Vidyalaya — home">
            <img className="e-seal" src="/school_logo.png" alt="" width={56} height={56} />
            <span className="e-school">
              Tufanganj Vivekananda Vidyalaya
              <small>Higher Secondary · Cooch Behar</small>
            </span>
          </a>
          <button type="button" className="e-toggle" aria-label="Toggle light and dark theme" onClick={() => setPreference(resolved === "dark" ? "light" : "dark")}>
            <svg className="moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
            </svg>
            <svg className="sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          </button>
        </header>

        <main className="e-stage">
          <section className="e-copy">
            <span className="e-pill">
              <i />
              Error {code} · {c.label}
            </span>
            <p className="e-code" data-code={code} aria-hidden="true">
              {code}
            </p>
            <span className="e-rule" />
            <h1 className="e-title">{c.heading}</h1>
            <p className="e-support">{c.support}</p>
            <blockquote className="e-quote">
              <p>“{c.quote}”</p>
              <cite>{c.cite}</cite>
            </blockquote>
            <div className="e-actions">
              {action(c.primary[0], c.primary[1], true)}
              {action(c.secondary[0], c.secondary[1], false)}
            </div>
          </section>

          <div className="e-art" aria-hidden="true">
            <div className="e-frameart">
              <span className="e-glow" />
              <span className="e-ring" />
              <span className="e-ring two" />
              <img className="e-img dark" src="/swami-dark.webp" alt="" width={750} height={1000} decoding="async" />
              <img className="e-img light" src="/swami-light.webp" alt="" width={750} height={1000} decoding="async" />
              <div className="e-sparks">
                {SPARKS.map((s) => (
                  <i key={s.x} style={{ "--x": s.x, "--s": s.s, "--d": s.d, "--t": s.t } as React.CSSProperties} />
                ))}
              </div>
            </div>
          </div>
        </main>

        <footer className="e-foot">
          <span className="e-copyr">© {new Date().getFullYear()} Tufanganj Vivekananda Vidyalaya (H.S.)</span>
          <span>
            HTTP <b>{code}</b>
          </span>
        </footer>
      </div>
    </div>
  );
}
