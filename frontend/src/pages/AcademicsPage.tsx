import { Link } from "react-router-dom";
import { Academics } from "../components/Academics";
import { PageHero, Section } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

export function AcademicsPage() {
  usePageMeta("Academics", `Academics at ${SITE.nameFull}: Science and Arts streams for Class XI–XII under the West Bengal Council of Higher Secondary Education.`);
  return (
    <>
      <PageHero crumb="Academics" eyebrow="Higher secondary academics in Tufanganj" title="Two streams, one standard of teaching." lede="From Class XI, students choose Science or Arts under the West Bengal Council of Higher Secondary Education. Both streams share the same academic seriousness.">
        <Link to="/admissions" className="btn btn-primary">Apply for admission</Link>
        <Link to="/faculty" className="btn btn-outline">Meet the teachers</Link>
      </PageHero>
      <Academics bare />
      <Section>
        <div className="prose" data-reveal>
          <h2 style={{ marginTop: 0 }}>Class V to Class X</h2>
          <p>
            Before the higher secondary stage, students study from Class V to Class X under the West Bengal Board of Secondary Education and sit the Madhyamik
            examination at the end of Class X. Stream choice — Science or Arts — is made at the start of Class XI.
          </p>
          <h2>Class XI and XII</h2>
          <p>
            The two higher secondary years follow the syllabus of the West Bengal Council of Higher Secondary Education, with the Higher Secondary examination at
            the end of Class XII. See the <Link to="/faq">FAQ</Link> for common questions, or <Link to="/admissions">send an admission enquiry</Link>.
          </p>
        </div>
      </Section>
    </>
  );
}
