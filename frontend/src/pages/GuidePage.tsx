import { Link } from "react-router-dom";
import { PageHero, Section } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

/** What to look at when comparing schools. General advice only — no claim that any school is "the best". */
const CHECKLIST = [
  { t: "Board and classes", d: "Check which board the school follows and which classes it teaches. A school that runs Class V to XII lets a child stay in one place for the whole school journey." },
  { t: "Streams after Class X", d: "If your child may want Science or Arts in Class XI, ask whether both streams are offered, which subjects they include and how the choice is made." },
  { t: "Teachers", d: "Ask to meet the teachers, and see whether they keep their own profiles and subjects up to date where parents can read them." },
  { t: "Talking to parents", d: "A good school tells parents what is happening: a notice board, regular parent–teacher meetings and a place online where announcements can be found." },
  { t: "Safety on campus", d: "Look at the gate, the supervision during breaks and whether each class has a teacher parents can contact directly." },
  { t: "Getting there", d: "Work out the daily journey from your home, and whether the school runs transport or students travel on their own." },
];

export function GuidePage() {
  usePageMeta("Choosing a school in Tufanganj", "A parent's checklist for choosing a school in Tufanganj, Cooch Behar.", "/school-in-tufanganj");
  return (
    <>
      <PageHero
        crumb="Choosing a school"
        eyebrow="School in Tufanganj, Cooch Behar"
        title="Choosing the best school in Tufanganj."
        lede="There is no single best school for every child. Use this checklist to compare the schools in Tufanganj on what matters for your child — then visit, ask questions and decide."
      >
        <Link to="/admissions" className="btn btn-primary">Admission enquiry</Link>
        <Link to="/contact" className="btn btn-outline">Arrange a visit</Link>
      </PageHero>

      <Section>
        <h2 className="pg-title" data-reveal>Six things to compare</h2>
        <p className="pg-sub" data-reveal>Whichever school you are looking at in Tufanganj, ask about these first.</p>
        <div className="card-grid">
          {CHECKLIST.map((c, i) => (
            <article className="feature" key={c.t} data-reveal style={{ ["--d" as string]: i % 3 }}>
              <span className="f-icon" style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 600 }}>{i + 1}</span>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <div className="split-2" style={{ alignItems: "start" }}>
          <div className="prose" data-reveal>
            <h2 style={{ marginTop: 0 }}>What {SITE.nameFull} offers</h2>
            <p>
              {SITE.name} (also written {SITE.alsoSpelt}, or simply TVV) is a higher secondary school in Tufanganj, Cooch Behar, established in {SITE.since}. It
              teaches <strong>Class V to Class XII</strong>. Classes V–X follow the West Bengal Board of Secondary Education; from Class XI students choose the{" "}
              <strong>Science</strong> or <strong>Arts</strong> stream under the West Bengal Council of Higher Secondary Education.
            </p>
            <p>
              The campus has a playing field, science laboratories, a computer centre and a library. Parents hear from the school through the notice board,
              parent–teacher meetings and the <Link to="/notices">notices on this website</Link>, and students and teachers use the school portal and the{" "}
              <Link to="/app">TVV School app</Link>.
            </p>
            <p>
              Read more about <Link to="/academics">academics</Link>, meet the <Link to="/faculty">teachers</Link>, look at the <Link to="/campus">campus</Link>, or
              see the <Link to="/faq">questions parents ask</Link>.
            </p>
          </div>
          <div className="prose" data-reveal>
            <h2 style={{ marginTop: 0 }}>Questions to ask any school</h2>
            <ul style={{ listStyle: "disc" }}>
              <li>Which classes and streams do you teach, and under which board?</li>
              <li>How and when do you contact parents?</li>
              <li>Who is my child's teacher-in-charge?</li>
              <li>What are the steps and dates for admission?</li>
              <li>May I see the classrooms, laboratories and playing field?</li>
            </ul>
            <p>Tufanganj Vivekananda Vidyalaya welcomes these questions: <Link to="/contact">write to the school office</Link> and we will tell you the best time to visit.</p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="cta-band" data-reveal>
          <div>
            <h2>Ready to take the next step?</h2>
            <p>Send an admission enquiry in two minutes, or write to the school office with any question.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/admissions" className="btn btn-primary">Start admission enquiry</Link>
            <Link to="/faq" className="btn btn-outline">Read the FAQ</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
