import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { SchoolLogo } from "./SchoolLogo";
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
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
          <NavLink to="/portal" className="btn btn-primary btn-sm">
            Student &amp; Staff Login
          </NavLink>
          <button
            className="burger"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-menu">
          <div className="wrap">
            {NAV_LINKS.map((link) =>
              isRoutePath(link.href) ? (
                <Link key={link.href} to={link.href} onClick={() => setMenuOpen(false)}>
                  {link.label}
                </Link>
              ) : (
                <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                  {link.label}
                </a>
              )
            )}
            <div className="cta">
              <NavLink to="/portal" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
                Student &amp; Staff Login
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
