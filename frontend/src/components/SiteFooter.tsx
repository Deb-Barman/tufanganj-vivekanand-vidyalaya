import { Link } from "react-router-dom";
import { MORE, NAV, SITE } from "../config/site";
import { SocialDock } from "./SocialDock";
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
        </div>
        <div className="footer-col">
          <h5>Help</h5>
          <Link to="/faq">FAQ</Link>
          <Link to="/downloads">Downloads</Link>
          <Link to="/portal">Student &amp; Staff Login</Link>
          {SITE.phone && <a href={`tel:${SITE.phone}`}>{SITE.phone}</a>}
          {SITE.email && <a href={`mailto:${SITE.email}`}>{SITE.email}</a>}
          <p className="footer-hours">{SITE.hours}</p>
        </div>
      </div>

      <div className="wrap footer-dock">
        <SocialDock />
      </div>

      <div className="wrap footer-base">
        <span>
          © {year} {SITE.nameFull}
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
