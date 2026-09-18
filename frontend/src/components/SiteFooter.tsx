import "./SiteFooter.css";

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
      <div className="wrap footer-bottom">
        <p>&copy; {new Date().getFullYear()} Tufanganj Vivekananda Vidyalaya (H.S.)</p>
      </div>
    </footer>
  );
}
