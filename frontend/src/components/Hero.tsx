import { Link } from "react-router-dom";
import "./Hero.css";

export function Hero() {
  return (
    <section className="hero">
      <div className="wrap hero-inner">
        <p className="eyebrow">
          <span className="status-dot" /> TUFANGANJ, COOCH BEHAR · EST. 1964
        </p>
        <h1>
          Sixty years in Tufanganj,
          <br />
          one student <span className="serif-word">at a time.</span>
        </h1>
        <p className="hero-description">
          Tufanganj Vivekananda Vidyalaya (H.S.) has taught this town's children since 1964 — through Class V to XII,
          in Science and Arts, on the field and in the lab.
        </p>
        <div className="hero-cta-row">
          <a href="/#admissions" className="btn btn-primary">
            Start Admission Enquiry
          </a>
          <Link to="/portal" className="btn btn-outline">
            Student &amp; Staff Login
          </Link>
        </div>
      </div>

      <div className="hero-bottom">
        <div className="wrap hero-quote-strip">
          <p>&ldquo;Take up one idea. Make that one idea your life — think of it, dream of it, live on that idea.&rdquo;</p>
          <span>Swami Vivekananda — after whom this Vidyalaya is named</span>
        </div>
        <div className="wrap hero-stats">
          <div className="hero-stat">
            <div className="n">1964</div>
            <div className="l">Year established</div>
          </div>
          <div className="hero-stat">
            <div className="n">V–XII</div>
            <div className="l">Classes taught</div>
          </div>
          <div className="hero-stat">
            <div className="n">2</div>
            <div className="l">H.S. streams — Science &amp; Arts</div>
          </div>
        </div>
      </div>
    </section>
  );
}
