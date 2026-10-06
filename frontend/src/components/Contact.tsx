import "./Contact.css";

export function Contact() {
  return (
    <section className="section" id="contact">
      <div className="wrap contact-grid">
        <div data-reveal="left">
          <div className="eyebrow">
            <span className="num">09</span>Visit or Write to Us
          </div>
          <h2 className="contact-h2">Find the school.</h2>
          <div className="contact-list">
            <div className="c-item">
              <strong>Address</strong>
              <p>Tufanganj, Cooch Behar, West Bengal, India</p>
            </div>
            <div className="c-item">
              <strong>Office hours</strong>
              <p>Monday–Saturday, during the school term</p>
            </div>
            <div className="c-item">
              <strong>Facebook</strong>
              <p>facebook.com/TufanganjVivekanandaVidyalaya</p>
            </div>
          </div>
        </div>
        <div className="todo-panel" data-reveal="right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
            <path d="M12 9v4M12 16.5h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <div>
            <strong>TODO / Required Data — Map &amp; direct contact details</strong>
            <p>A live map embed and a direct phone number/email were not provided and are not invented here.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
