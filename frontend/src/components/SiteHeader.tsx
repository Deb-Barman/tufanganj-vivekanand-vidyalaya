import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import "./SiteHeader.css";

const NAV_LINKS = [
  { href: "/#about", label: "About" },
  { href: "/#academics", label: "Academics" },
  { href: "/#teachers", label: "Faculty" },
  { href: "/#achievements", label: "Achievements" },
  { href: "/#campus", label: "Campus" },
  { href: "/#notices", label: "Notices" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#admissions", label: "Admissions" },
  { href: "/#contact", label: "Contact" },
];

function Crest() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="34" height="34" aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#5D46B9" />
      <circle cx="100" cy="100" r="98" fill="none" stroke="#48368F" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="81" fill="#FBFAFD" />
      <circle cx="100" cy="100" r="73" fill="none" stroke="#5D46B9" strokeWidth="4" />
      <circle cx="100" cy="104" r="46" fill="#382A6F" />
      <text x="100" y="116" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="46" fill="#FBFAFD">
        T
      </text>
    </svg>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="wrap nav-row">
        <Link to="/" className="brand">
          <Crest />
          <span className="name">
            T.V. Vidyalaya <small>Official Site</small>
          </span>
        </Link>

        <nav className="primary" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
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
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
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
