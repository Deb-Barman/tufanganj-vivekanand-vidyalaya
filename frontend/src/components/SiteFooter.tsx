import { Link } from "react-router-dom";
import { MORE, NAV, SITE } from "../config/site";
import { DEVELOPER } from "../config/developer";
import { SocialIcons } from "./SocialIcons";
import "./SiteFooter.css";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <p className="brand-name">
            Tufanganj Vivekananda
            <br />
            Vidyalaya (H.S.)
          </p>
          <p>A Higher Secondary institution in {SITE.town.replace(", India", "")} — Class V to XII, Science &amp; Arts streams.</p>
          <p className="footer-motto">{SITE.motto}</p>
          <ul className="footer-contact" aria-label="School contact details">
            <li>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.6" /></svg>
              <span>{SITE.town}</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              <span>{SITE.hours}</span>
            </li>
            {SITE.phone && (
              <li>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
                <a href={`tel:${SITE.phone}`}>{SITE.phone}</a>
              </li>
            )}
            {SITE.email && (
              <li>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
              </li>
            )}
          </ul>
          <Link to="/contact" className="footer-cta">
            Contact the school office <span aria-hidden="true">→</span>
          </Link>
          <div className="footer-social">
            <h5>Follow us</h5>
            <SocialIcons />
          </div>
        </div>
        <div className="footer-col">
          <h5>Explore</h5>
          {NAV.slice(0, 5).map((n) => (
            <Link key={n.to} to={n.to}>
              {n.label}
            </Link>
          ))}
        </div>
        <div className="footer-col">
          <h5>School</h5>
          {NAV.slice(5).map((n) => (
            <Link key={n.to} to={n.to}>
              {n.label}
            </Link>
          ))}
          <Link to="/events">Events</Link>
          <Link to="/gallery">Gallery</Link>
        </div>
        <div className="footer-col">
          <h5>Help</h5>
          <Link to="/find-profile">Profile Finder</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/downloads">Downloads</Link>
          <Link to="/app">Get the App</Link>
          <Link to="/portal">Student &amp; Staff Login</Link>
          <Link to="/developer">Developer</Link>
        </div>
      </div>

      <div className="wrap footer-base">
        <span>
          © {year} {SITE.nameFull}
        </span>
        <span className="footer-dev">
          Designed &amp; developed by{" "}
          <Link to="/developer" className="footer-dev-link">
            {DEVELOPER.name} →
          </Link>
        </span>
        <span className="footer-legal">
          {MORE.filter((m) => m.to === "/privacy" || m.to === "/terms").map((m) => (
            <Link key={m.to} to={m.to}>
              {m.label}
            </Link>
          ))}
        </span>
      </div>
    </footer>
  );
}
