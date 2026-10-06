import { SocialLinks } from "./SocialLinks";
import type { SocialLink } from "./SocialLinks";
import "./SiteFooter.css";

// Only real, published accounts for the school go here — nothing invented.
// Facebook is the one confirmed in /#contact; add others here once Deb
// shares a real handle for them.
const SOCIAL_LINKS: SocialLink[] = [
  {
    name: "Facebook",
    href: "https://facebook.com/TufanganjVivekanandaVidyalaya",
    brand: "#0866ff",
    glow: "rgba(8, 102, 255, .5)",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M16 8.05A8 8 0 1 0 6.74 16V10.37H4.72V8.05h2.02V6.3c0-2 1.19-3.1 3-3.1.87 0 1.78.16 1.78.16v1.95h-1c-.99 0-1.3.61-1.3 1.24v1.5h2.21l-.35 2.32H9.2V16A8 8 0 0 0 16 8.05" />
      </svg>
    ),
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <p className="brand-name">
            Tufanganj Vivekananda
            <br />
            Vidyalaya (H.S.)
          </p>
          <p>A Higher Secondary institution in Tufanganj, Cooch Behar, West Bengal — Class V to XII, Science &amp; Arts streams.</p>
        </div>
        <div className="footer-col">
          <h5>Explore</h5>
          <a href="/#about">About</a>
          <a href="/#academics">Academics</a>
          <a href="/#teachers">Faculty</a>
          <a href="/#campus">Campus</a>
        </div>
        <div className="footer-col">
          <h5>Portal</h5>
          <a href="/#notices">Notice Board</a>
          <a href="/#admissions">Admissions</a>
          <a href="/#contact">Contact</a>
        </div>
        <div className="footer-col">
          <h5>Contact</h5>
          <p className="muted">Tufanganj, Cooch Behar, West Bengal, India</p>
          <p className="muted">Monday–Saturday, during the school term</p>
        </div>
      </div>
      <div className="wrap footer-social">
        <SocialLinks links={SOCIAL_LINKS} />
      </div>
      <div className="wrap footer-bottom">
        <p>&copy; {new Date().getFullYear()} Tufanganj Vivekananda Vidyalaya (H.S.)</p>
      </div>
    </footer>
  );
}
