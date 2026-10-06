import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { SchoolLogo } from "./SchoolLogo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "../lib/AuthContext";
import "./SiteHeader.css";

const NAV_LINKS = [
  { href: "/#about", label: "About" },
  { href: "/#academics", label: "Academics" },
  { href: "/#teachers", label: "Faculty" },
  { href: "/#achievements", label: "Achievements" },
  { href: "/#campus", label: "Campus" },
  { href: "/#notices", label: "Notices" },
  { href: "/blog", label: "Blog" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#admissions", label: "Admissions" },
  { href: "/#contact", label: "Contact" },
];

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
          {NAV_LINKS.map((link) =>
            isRoutePath(link.href) ? (
              <Link key={link.href} to={link.href}>
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            )
          )}
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
              <Link key={link.href} to={link.href} onClick={() => setMenuOpen(false)} style={{ ["--i" as string]: i }} tabIndex={menuOpen ? 0 : -1}>
                {link.label}
              </Link>
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
