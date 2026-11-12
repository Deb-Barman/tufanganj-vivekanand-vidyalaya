import { Link } from "react-router-dom";
import { Admissions } from "../components/Admissions";
import { PageHero } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

export function AdmissionsPage() {
  usePageMeta("Admissions", `How to apply to ${SITE.nameFull}: send an admission enquiry online and the school office will contact you.`);
  return (
    <>
      <PageHero crumb="Admissions" eyebrow="School admission in Tufanganj" title="How to join TVV." lede="Admissions run in three straightforward steps. Send an enquiry below, or contact the school office directly for live dates and forms.">
        <Link to="/downloads" className="btn btn-outline">Download forms</Link>
        <Link to="/faq" className="btn btn-outline">Read the FAQ</Link>
      </PageHero>
      <Admissions bare />
    </>
  );
}
