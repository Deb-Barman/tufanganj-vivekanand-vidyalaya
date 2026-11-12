import { Link } from "react-router-dom";
import { Section } from "../site/PageHero";
import { SITE } from "../../config/site";

/**
 * A short, plain-language introduction to the school with links to the pages parents look for.
 * Visible to everyone (no hidden text): it tells visitors — and search engines — what and where the school is.
 * Only facts already published elsewhere on this site are used.
 */
export function SchoolIntro() {
  return (
    <Section>
      <div className="split-2" style={{ alignItems: "start" }} data-reveal>
        <div>
          <div className="eyebrow">About the school</div>
          <h2 className="pg-title">A higher secondary school in Tufanganj, Cooch Behar</h2>
        </div>
        <div>
          <p className="pg-sub">
            {SITE.nameFull} is a higher secondary school in Tufanganj, Cooch Behar, West Bengal. Since {SITE.since} it has taught Class V to XII, with Science
            and Arts streams in Class XI and XII under the West Bengal Council of Higher Secondary Education.
          </p>
          <p className="pg-sub">
            Parents and students can read the latest <Link to="/notices">school notices</Link>, send an online <Link to="/admissions">admission enquiry</Link>,
            meet the <Link to="/faculty">teachers</Link>, see <Link to="/achievements">results and achievements</Link>, and look at the{" "}
            <Link to="/campus">campus facilities</Link> — playing field, science laboratories, computer centre and library.
          </p>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <Link to="/academics" className="btn btn-outline btn-sm">Academics</Link>
            <Link to="/about" className="btn btn-outline btn-sm">About the school</Link>
            <Link to="/contact" className="btn btn-outline btn-sm">Contact &amp; location</Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
