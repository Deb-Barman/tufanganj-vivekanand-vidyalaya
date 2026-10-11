import { Link } from "react-router-dom";
import { Academics } from "../components/Academics";
import { PageHero } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

export function AcademicsPage() {
  usePageMeta("Academics", `Academics at ${SITE.nameFull}: Science and Arts streams for Class XI–XII under the West Bengal Council of Higher Secondary Education.`);
  return (
    <>
      <PageHero crumb="Academics" eyebrow="Academics" title="Two streams, one standard of teaching." lede="From Class XI, students choose Science or Arts under the West Bengal Council of Higher Secondary Education. Both streams share the same academic seriousness.">
        <Link to="/admissions" className="btn btn-primary">Apply for admission</Link>
        <Link to="/faculty" className="btn btn-outline">Meet the teachers</Link>
      </PageHero>
      <Academics bare />
    </>
  );
}
