import { Link } from "react-router-dom";
import { Faq } from "../components/Faq";
import { PageHero } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

export function FaqPage() {
  usePageMeta("FAQ", `Frequently asked questions about admissions, classes and school life at ${SITE.nameFull}.`);
  return (
    <>
      <PageHero crumb="FAQ" eyebrow="Questions parents ask" title="Answered before you have to call." lede="Can't find your question? Write to the school office and we will reply.">
        <Link to="/contact" className="btn btn-outline">Ask the office</Link>
      </PageHero>
      <Faq bare />
    </>
  );
}
