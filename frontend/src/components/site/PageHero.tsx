import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import "./site.css";

/** Standard header for every public page: breadcrumb, eyebrow, title, intro, optional actions. */
export function PageHero({ eyebrow, title, lede, crumb, children }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; crumb: string; children?: ReactNode }) {
  return (
    <header className="page-hero">
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{crumb}</span>
        </nav>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children && <div className="hero-actions">{children}</div>}
      </div>
    </header>
  );
}

export function Section({ children, className = "", tight = false }: { children: ReactNode; className?: string; tight?: boolean }) {
  return (
    <section className={`pg-section ${tight ? "tight" : ""} ${className}`}>
      <div className="wrap">{children}</div>
    </section>
  );
}

export function EmptyPanel({ icon = "info", title, children }: { icon?: "info" | "calendar" | "file" | "award"; title: string; children?: ReactNode }) {
  const paths: Record<string, string> = {
    info: "M12 9v4M12 16.5h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
    file: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4",
    award: "M12 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8.5 13.5 7 22l5-3 5 3-1.5-8.5",
  };
  return (
    <div className="empty-panel" data-reveal>
      <span className="ep-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
          <path d={paths[icon]} />
        </svg>
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
