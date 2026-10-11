import { Link } from "react-router-dom";
import { PageHero, Section } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";

const VALUES = [
  { t: "Knowledge", d: "A solid academic foundation in every subject." },
  { t: "Character", d: "Honesty, discipline and respect for others." },
  { t: "Progress", d: "Helping every student move forward, year after year." },
];

export function AboutPage() {
  usePageMeta("About us", `About ${SITE.nameFull}: serving Tufanganj, Cooch Behar since ${SITE.since}. Class V to XII, Science and Arts streams.`);
  const age = new Date().getFullYear() - SITE.since;
  return (
    <>
      <PageHero crumb="About" eyebrow="About the school" title={<>A school for Tufanganj, since {SITE.since}.</>} lede={`${SITE.nameFull} has been teaching the children of Tufanganj for more than ${Math.floor(age / 10) * 10} years — from Class V through Higher Secondary.`} />

      <Section>
        <div className="split-2">
          <div className="prose" data-reveal>
            <h2 style={{ marginTop: 0 }}>Our story</h2>
            <p>
              {SITE.name} was established in {SITE.since} in {SITE.town.replace(", India", "")}. It is a Higher Secondary school
              that takes students from Class V to Class XII, so a child can complete their entire school journey in one place.
            </p>
            <p>
              From Class XI, students choose the <strong>Science</strong> or <strong>Arts</strong> stream under the West Bengal
              Council of Higher Secondary Education. Both streams are taught with the same seriousness.
            </p>
            <h2>Named after Swami Vivekananda</h2>
            <p>
              The school carries the name of Swami Vivekananda, and his call to young people — to rise, to wake up and to keep going
              until the goal is reached — is on the school's seal and is the spirit we try to bring into the classroom.
            </p>
          </div>
          <div style={{ display: "grid", gap: 22 }}>
            <div className="seal-card" data-reveal>
              <img src="/school_logo.png" alt="Seal of Tufanganj Vivekananda Vidyalaya" width={260} height={260} loading="lazy" />
            </div>
            <figure className="quote-card" data-reveal style={{ margin: 0 }}>
              <p>{SITE.quote.text}</p>
              <cite>— {SITE.quote.by}</cite>
            </figure>
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="pg-title" data-reveal>
          The school at a glance
        </h2>
        <div className="facts" data-reveal>
          <div className="fact"><b>{SITE.since}</b><span>Year established</span></div>
          <div className="fact"><b>V–XII</b><span>Classes taught</span></div>
          <div className="fact"><b>2</b><span>Streams: Science &amp; Arts</span></div>
          <div className="fact"><b>WBCHSE</b><span>Higher Secondary board</span></div>
        </div>
      </Section>

      <Section>
        <h2 className="pg-title" data-reveal>
          What we stand for
        </h2>
        <p className="pg-sub" data-reveal>
          Our motto, {SITE.motto}, is on the school seal. These three words guide how we teach.
        </p>
        <div className="card-grid">
          {VALUES.map((v, i) => (
            <article className="feature" key={v.t} data-reveal style={{ ["--d" as string]: i }}>
              <span className="f-icon" style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 600 }}>{v.t[0]}</span>
              <h3>{v.t}</h3>
              <p>{v.d}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <div className="cta-band" data-reveal>
          <div>
            <h2>Come and see the school.</h2>
            <p>{SITE.hours}. Write to us first and we will tell you the best time to visit.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/admissions" className="btn btn-primary">Admissions</Link>
            <Link to="/contact" className="btn btn-outline">Contact us</Link>
          </div>
        </div>
      </Section>
    </>
  );
}
