import { Link } from "react-router-dom";
import { Campus } from "../components/Campus";
import { PageHero } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

export function CampusPage() {
  usePageMeta("Campus & facilities", `Campus and facilities at ${SITE.nameFull}: playing field, science laboratories, computer centre and library.`);
  return (
    <>
      <PageHero crumb="Campus" eyebrow="Campus & facilities" title="Beyond the classroom." lede="A school is more than lessons. Our campus gives students room to run, build, read and compete.">
        <Link to="/contact" className="btn btn-primary">Arrange a visit</Link>
      </PageHero>
      <Campus bare />
    </>
  );
}
