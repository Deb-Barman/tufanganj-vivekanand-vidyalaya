import { Link } from "react-router-dom";
import { PageHero, Section } from "../components/site/PageHero";
import { DEVELOPER, DEV_LINKS } from "../config/developer";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";
import "./DeveloperPage.css";

const BUILT = [
  { t: "Public website", d: "Notices, articles, events, gallery, downloads, faculty and an admissions enquiry form, each page with its own address and search-friendly title." },
  { t: "Secure school portal", d: "Separate dashboards for the Super Admin, Teachers and Students. There is no public sign-up: accounts are created only by the school." },
  { t: "Everyday school work", d: "Attendance, results and marksheets, timetable, homework and exams, kept in one place for teachers and students." },
  { t: "Built for phones", d: "Fast on slow connections, readable in light and dark themes, with loading screens that match the page they replace." },
  { t: "Careful with data", d: "Permissions are checked on the server, repeated wrong passwords lock an account, uploads are verified and public forms are rate-limited." },
];

const STACK = ["React", "TypeScript", "Vite", "React Router", "Python", "Django", "Django REST Framework", "JWT sign-in", "PostgreSQL (Supabase)", "Vercel", "Render"];

export function DeveloperPage() {
  usePageMeta("Developer", `${SITE.nameFull} website and portal were designed and developed by ${DEVELOPER.name} — ${DEVELOPER.role}.`);
  return (
    <>
      <PageHero
        crumb="Developer"
        eyebrow="Behind the website"
        title={<>Designed &amp; developed by {DEVELOPER.name}.</>}
        lede={`${DEVELOPER.role}. This page is for anyone who wants to know who built this website and the student & teacher portal, and how to reach the developer.`}
      >
        <a className="btn btn-primary" href={DEV_LINKS.find((l) => l.label === "Portfolio")?.href} target="_blank" rel="noopener noreferrer me">
          View portfolio
        </a>
        <a className="btn btn-outline" href={DEV_LINKS.find((l) => l.label === "GitHub")?.href} target="_blank" rel="noopener noreferrer me">
          GitHub
        </a>
      </PageHero>

      <Section>
        <div className="dev-card" data-reveal>
          <span className="dev-card-avatar" aria-hidden="true">{DEVELOPER.initials}</span>
          <div>
            <h2 className="dev-card-name">{DEVELOPER.name}</h2>
            <p className="dev-card-role">{DEVELOPER.role}</p>
            <p className="dev-card-bio">
              Builds software with Python and works across AI agents and machine learning. This website and the school portal are his work for {SITE.name}.
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <div className="section-head" data-reveal>
          <div className="eyebrow">What was built</div>
          <h2>One website, one portal, one school.</h2>
        </div>
        <div className="card-grid">
          {BUILT.map((b, i) => (
            <article className="feature" key={b.t} data-reveal style={{ ["--d" as string]: i % 4 }}>
              <h3>{b.t}</h3>
              <p>{b.d}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <div className="section-head" data-reveal>
          <div className="eyebrow">Technology</div>
          <h2>What it runs on.</h2>
        </div>
        <ul className="dev-stack" data-reveal>
          {STACK.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="section-head" data-reveal>
          <div className="eyebrow">Find the developer</div>
          <h2>Say hello online.</h2>
        </div>
        <ul className="dev-link-grid">
          {DEV_LINKS.map((l, i) => (
            <li key={l.href} data-reveal style={{ ["--d" as string]: i % 3 }}>
              <a className="dev-link-card" href={l.href} target="_blank" rel="noopener noreferrer me">
                <span className="dev-link-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d={l.path} /></svg>
                </span>
                <span className="dev-link-text">
                  <strong>{l.label}</strong>
                  <small>{l.handle}</small>
                  <em>{l.note}</em>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="dev-foot">
          Found a problem on the website? <Link to="/contact">Tell the school office</Link> and mention the page address.
        </p>
      </Section>
    </>
  );
}
