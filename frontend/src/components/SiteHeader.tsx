import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { MORE, NAV } from "../config/site";
import { SchoolLogo } from "./SchoolLogo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../lib/AuthContext";
import "./SiteHeader.css";

const NAV_LINKS = NAV.map((n) => ({ href: n.to, label: n.label }));

/* Desktop bar: the pages people look for first, in the order they look for them; everything else lives under "More". */
const PRIMARY_PATHS = ["/about", "/academics", "/faculty", "/notices", "/admissions", "/contact"];
const DESKTOP_LINKS = [{ to: "/", label: "Home" }, ...NAV.filter((n) => PRIMARY_PATHS.includes(n.to))];
const MORE_LINKS = [...NAV.filter((n) => !PRIMARY_PATHS.includes(n.to)), ...MORE.filter((m) => ["/events", "/downloads", "/faq", "/gallery", "/app"].includes(m.to))];

/** "More ▾" menu for the desktop bar: a soft raised panel with every other public page. */
function MoreMenu() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const inMore = MORE_LINKS.some((l) => pathname === l.to || pathname.startsWith(l.to + "/"));

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="nav-more" ref={box}>
      <button type="button" className={`more-btn${inMore ? " active" : ""}${open ? " open" : ""}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        More
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="more-panel" role="menu">
          {MORE_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} role="menuitem" className={({ isActive }) => (isActive ? "active" : undefined)}>
              <strong>{l.label}</strong>
              <small>{l.desc}</small>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function isRoutePath(href: string) {
  return !href.includes("#");
}

export function SiteHeader() {
  const { user } = useAuth();
  const loginTo = user ? "/portal/dashboard" : "/portal";
  const loginLabel = user ? "Dashboard" : "Student & Staff Login";
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock page scroll behind the open mobile menu.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={`site-header${scrolled ? " scrolled" : ""}${menuOpen ? " open" : ""}`}>
      <div className="wrap nav-row">
        <Link to="/" className="brand">
          <SchoolLogo size={34} />
          <span className="name">
            T.V. Vidyalaya <small>Official Site</small>
          </span>
        </Link>

        <nav className="primary" aria-label="Main navigation">
          {DESKTOP_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/"} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {link.label}
            </NavLink>
          ))}
          <MoreMenu />
        </nav>

        <div className="nav-actions">
          <ThemeToggle className="nav-theme" />
          <NavLink to={loginTo} className="btn btn-primary btn-sm nav-login">
            <span className="lbl-full">{loginLabel}</span>
            <span className="lbl-short">{user ? "Portal" : "Login"}</span>
          </NavLink>
          <button
            className={`burger${menuOpen ? " is-open" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      <div className={`mobile-menu${menuOpen ? " show" : ""}`} aria-hidden={!menuOpen}>
        <div className="wrap mm-inner">
          {NAV_LINKS.map((link, i) =>
            isRoutePath(link.href) ? (
              <NavLink key={link.href} to={link.href} onClick={() => setMenuOpen(false)} style={{ ["--i" as string]: i }} tabIndex={menuOpen ? 0 : -1}>
                {link.label}
              </NavLink>
            ) : (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{ ["--i" as string]: i }} tabIndex={menuOpen ? 0 : -1}>
                {link.label}
              </a>
            )
          )}
          <div className="mm-foot" style={{ ["--i" as string]: NAV_LINKS.length }}>
            <ThemeToggle />
            <NavLink to={loginTo} className="btn btn-primary" onClick={() => setMenuOpen(false)} tabIndex={menuOpen ? 0 : -1}>
              {loginLabel}
            </NavLink>
          </div>
        </div>
      </div>
    </header>
  );
}
