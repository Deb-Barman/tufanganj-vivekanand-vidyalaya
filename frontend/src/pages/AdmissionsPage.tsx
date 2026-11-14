import { Link } from "react-router-dom";
import { Admissions } from "../components/Admissions";
import { PageHero, Section } from "../components/site/PageHero";
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
      <Section>
        <div className="prose" data-reveal>
          <h2 style={{ marginTop: 0 }}>School admission in Tufanganj: what to know</h2>
          <p>
            {SITE.nameFull} teaches Class V to XII. In Class XI students choose the Science or the Arts stream. Admissions generally open ahead of the new academic
            session — send the enquiry above, or write to the <Link to="/contact">school office</Link> for current dates.
          </p>
          <p>
            Admission forms and other documents are on the <Link to="/downloads">Downloads</Link> page. Still comparing schools? Read our{" "}
            <Link to="/school-in-tufanganj">checklist for choosing a school in Tufanganj</Link> and the <Link to="/faq">FAQ</Link>.
          </p>
        </div>
      </Section>
    </>
  );
}
