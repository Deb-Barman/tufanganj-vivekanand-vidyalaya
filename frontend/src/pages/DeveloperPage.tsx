import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CountUp } from "../components/portfolio/CountUp";
import { useScrollProgress } from "../components/home/scroll";
import { Magnetic } from "../components/home/Magnetic";
import { DEVELOPER, DEV_LINKS } from "../config/developer";
import { SITE } from "../config/site";
import { usePageMeta } from "../lib/usePageMeta";
import { navFor } from "../portal/ui/nav";
import "./DeveloperPage.css";

/* Everything here describes what this site really contains. */
const BUILT: { t: string; d: string; icon: string; wide?: boolean; full?: boolean }[] = [
  { t: "Secure school portal", d: "Separate dashboards for the Super Admin, Teachers and Students. There is no public sign-up: accounts are created only by the school, and every permission is checked on the server.", icon: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3Zm-3 9 2 2 4-4", wide: true },
  { t: "Public website", d: "Notices, articles, events, gallery, downloads, faculty and an admissions enquiry form, each page with its own address and a search-friendly title.", icon: "M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" },
  { t: "Everyday school work", d: "Attendance, results and marksheets, timetable, homework and exams — and a year-end tool that promotes students without losing any history.", icon: "M4 5h16v14H4zM4 10h16M9 5v14" },
  { t: "Student portfolios", d: "Every student can publish a portfolio page: skills, projects, achievements, and — only if they choose — results and a GitHub-style attendance calendar.", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" },
  { t: "Built for phones", d: "Fast on slow connections, readable in light and dark themes, with loading screens that match the page they replace.", icon: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm4 17h.01" },
  { t: "Careful with data", d: "Repeated wrong passwords lock an account, uploads are verified, public forms are rate-limited, and private details never reach the public pages.", icon: "M6 10V8a6 6 0 1 1 12 0v2M5 10h14v11H5z", full: true },
];

const STACK = ["React", "TypeScript", "Vite", "React Router", "Python", "Django", "Django REST Framework", "JWT sign-in", "PostgreSQL (Supabase)", "Vercel", "Render"];
const ROLES = ["Python developer", "AI & ML builder", "AI agent builder", "Full-stack maker"];

function RoleTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % ROLES.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="dv-ticker" aria-live="off">
      {ROLES.map((r, n) => <span key={r} className={n === i ? "on" : n === (i + ROLES.length - 1) % ROLES.length ? "out" : ""}>{r}</span>)}
    </span>
  );
}

/** Spotlight that follows the mouse across a card (mouse devices only). */
const spot = (e: React.PointerEvent<HTMLElement>) => {
  if (e.pointerType !== "mouse") return;
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--sx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--sy", `${e.clientY - r.top}px`);
};

export function DeveloperPage() {
  usePageMeta("Developer", `${SITE.nameFull} website and portal were designed and developed by ${DEVELOPER.name} — ${DEVELOPER.role}.`);
  const hero = useScrollProgress<HTMLElement>("exit");
  const strip = useScrollProgress<HTMLElement>("view");
  const tools = navFor("SUPER_ADMIN").length;
  const portfolio = DEV_LINKS.find((l) => l.label === "Portfolio")?.href;
  const github = DEV_LINKS.find((l) => l.label === "GitHub")?.href;

  return (
    <div className="dv">
      {/* ───── hero ───── */}
      <header className="dv-hero" ref={hero}>
        <div className="dv-bg" aria-hidden="true"><i /><i /><i /><span /></div>
        <div className="wrap dv-hero-grid">
          <div className="dv-copy">
            <nav className="dv-crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Developer</span></nav>
            <span className="dv-eyebrow"><i /> Behind the website</span>
            <h1>
              Designed &amp; developed by <span className="dv-name">{DEVELOPER.name}</span>
            </h1>
            <p className="dv-role">A <RoleTicker /> from India.</p>
            <p className="dv-lede">This page is for anyone who wants to know who built this website and the student &amp; teacher portal of {SITE.name}, and how to reach the developer.</p>
            <div className="dv-cta">
              <Magnetic><a className="dv-btn primary" href={portfolio} target="_blank" rel="noopener noreferrer me">View portfolio <span aria-hidden="true">↗</span></a></Magnetic>
              <Magnetic><a className="dv-btn ghost" href={github} target="_blank" rel="noopener noreferrer me">GitHub <span aria-hidden="true">↗</span></a></Magnetic>
            </div>
          </div>

          <div className="dv-visual" aria-hidden="true">
            <div className="dv-orbit"><i /><i /><i /></div>
            <div className="dv-window">
              <div className="dv-window-bar"><i /><i /><i /><span>developer.py</span></div>
              <pre>
<b className="k">class</b> <b className="c">Developer</b>:{"\n"}
{"    "}name = <b className="s">"{DEVELOPER.name}"</b>{"\n"}
{"    "}role = <b className="s">"{DEVELOPER.role}"</b>{"\n"}
{"    "}builds = [<b className="s">"school portal"</b>,{"\n"}
{"              "}<b className="s">"AI agents"</b>,{"\n"}
{"              "}<b className="s">"ML projects"</b>]{"\n"}
{"\n"}
{"    "}<b className="k">def</b> <b className="f">hello</b>(self):{"\n"}
{"        "}<b className="k">return</b> <b className="s">"Thanks for visiting!"</b><span className="dv-caret" />
              </pre>
            </div>
            <span className="dv-badge a"><b>{DEVELOPER.initials}</b></span>
            <span className="dv-badge b">Python</span>
            <span className="dv-badge c2">AI · ML</span>
          </div>
        </div>
      </header>

      {/* ───── numbers ───── */}
      <section className="dv-nums" aria-label="The project in numbers">
        <div className="wrap dv-nums-grid">
          {[{ n: 3, l: "Dashboards", s: "Admin · Teacher · Student" }, { n: tools, l: "Portal tools", s: "in the Super Admin dashboard" }, { n: STACK.length, l: "Technologies", s: "front to back" }, { n: 1, l: "School", s: SITE.name }].map((x, i) => (
            <div className="dv-num" key={x.l} data-reveal style={{ ["--d" as string]: i }}>
              <b><CountUp to={x.n} duration={1300} /></b>
              <span>{x.l}</span>
              <small>{x.s}</small>
            </div>
          ))}
        </div>
      </section>

      {/* ───── what was built ───── */}
      <section className="dv-sec">
        <div className="wrap">
          <div className="dv-head" data-reveal>
            <span className="dv-eyebrow"><i /> What was built</span>
            <h2>One website, one portal, <em>one school.</em></h2>
          </div>
          <div className="dv-bento">
            {BUILT.map((b, i) => (
              <article key={b.t} className={`dv-tile${b.wide ? " wide" : ""}${b.full ? " full" : ""}`} onPointerMove={spot} data-reveal style={{ ["--d" as string]: i % 3 }}>
                <span className="dv-tile-ico"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={b.icon} /></svg></span>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───── stack ───── */}
      <section className="dv-sec dv-stack-sec" ref={strip}>
        <div className="wrap"><div className="dv-head" data-reveal><span className="dv-eyebrow"><i /> Technology</span><h2>What it runs on.</h2></div></div>
        {[0, 1].map((row) => (
          <div className="dv-marq" key={row}>
            <div className="dv-marq-track">
              {[...STACK, ...STACK, ...STACK].map((s, i) => <span key={i}><i />{s}</span>)}
            </div>
          </div>
        ))}
      </section>

      {/* ───── contact ───── */}
      <section className="dv-sec">
        <div className="wrap">
          <div className="dv-head" data-reveal>
            <span className="dv-eyebrow"><i /> Find the developer</span>
            <h2>Say hello <em>online.</em></h2>
          </div>
          <ul className="dv-links">
            {DEV_LINKS.map((l, i) => (
              <li key={l.href} data-reveal style={{ ["--d" as string]: i % 3 }}>
                <a className="dv-link" href={l.href} target="_blank" rel="noopener noreferrer me" onPointerMove={spot}>
                  <span className="dv-link-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d={l.path} /></svg></span>
                  <span className="dv-link-text"><strong>{l.label}</strong><small>{l.handle}</small><em>{l.note}</em></span>
                  <span className="dv-link-go" aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="dv-foot">Found a problem on the website? <Link to="/contact">Tell the school office</Link> and mention the page address.</p>
        </div>
      </section>
    </div>
  );
}
