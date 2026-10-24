import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PersonPhoto } from "../components/media/PersonPhoto";
import { SocialIcon } from "../components/site/SocialIcon";
import { Sk } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { api, ApiError } from "../lib/api";
import { AttendanceHeatmap } from "../components/portfolio/AttendanceHeatmap";
import { CountUp } from "../components/portfolio/CountUp";
import { ResultsExplorer } from "../components/portfolio/ResultsExplorer";
import { SOCIAL_SITES } from "../lib/mediaLinks";
import { usePageMeta } from "../lib/usePageMeta";
import type { AchievementKind, PublicProfile } from "../types/api";
import "./PublicProfile.css";

const GENDER: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

/** Keep these pages out of search engines: they describe students, so they are shared by link, not indexed. */
function useNoIndex() {
  useEffect(() => {
    const el = document.createElement("meta");
    el.name = "robots";
    el.content = "noindex, nofollow";
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
}

const LEVEL_WORD = ["Beginner", "Learning", "Good", "Strong", "Expert"];
const KIND_LABEL: Record<AchievementKind, string> = { award: "Award", competition: "Competition", certificate: "Certificate", activity: "Activity", other: "Achievement" };
const KIND_PATH: Record<AchievementKind, string> = {
  award: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3",
  competition: "M5 21V4m0 0h11l-2 4 2 4H5",
  certificate: "M6 3h12v14l-6-3-6 3V3Z",
  activity: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z",
  other: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z",
};

const Card = ({ id, title, children, className = "" }: { id?: string; title: string; children: React.ReactNode; className?: string }) => (
  <section id={id} className={`pp-block ${className}`} data-reveal>
    <h2>{title}</h2>
    {children}
  </section>
);
const Para = ({ children }: { children: string }) => <p className="pp-para">{children}</p>;

const linkLabel = (url: string) => {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === "github.com" ? "View on GitHub" : "Project details";
  } catch {
    return "Open";
  }
};

/** Public page: /profile/student/<username> and /profile/teacher/<username>. Shows only what the owner chose to publish. */
export function PublicProfilePage() {
  const { role = "", username = "" } = useParams();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  useNoIndex();

  useEffect(() => {
    let alive = true;
    // oxlint-disable-next-line react/set-state-in-effect
    setState("loading");
    api.get<PublicProfile>(`/auth/profiles/${encodeURIComponent(role)}/${encodeURIComponent(username)}/`, { auth: false }).then(
      (p) => { if (alive) { setData(p); setState("ok"); } },
      (e) => { if (alive) setState(e instanceof ApiError && e.status === 404 ? "missing" : "error"); },
    );
    return () => {
      alive = false;
    };
  }, [role, username]);

  usePageMeta(data ? data.full_name : "Profile", data ? `${data.full_name}${data.headline ? " — " + data.headline : ""} at ${SITE.nameFull}.` : `A profile at ${SITE.nameFull}.`);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: data?.full_name, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* the person closed the share sheet — nothing to do */
    }
  }

  if (state === "loading")
    return (
      <div className="pp wrap" aria-busy="true">
        <div className="pp-hero"><div className="pp-hero-body"><Sk circle w={132} h={132} /><div style={{ flex: 1, display: "grid", gap: 12 }}><Sk w="60%" h={34} /><Sk w="40%" h={16} /><Sk w="80%" h={16} /></div></div></div>
        <div className="pp-stats"><Sk h={86} /><Sk h={86} /><Sk h={86} /><Sk h={86} /></div>
        <div className="pp-cols"><div className="pp-main"><Sk h={180} /><Sk h={240} /></div><div className="pp-side"><Sk h={200} /><Sk h={160} /></div></div>
      </div>
    );

  if (state !== "ok" || !data)
    return (
      <div className="pp wrap">
        <div className="pp-missing">
          <h1>{state === "missing" ? "This profile is not available" : "Could not load this profile"}</h1>
          <p>{state === "missing" ? "The link may be wrong, or the person has not made their profile public." : "Please check your connection and try again."}</p>
          <Link className="btn btn-primary" to="/faculty">Meet our faculty</Link>
        </div>
      </div>
    );

  const isStudent = data.role === "student";
  const first = data.full_name.split(" ")[0];
  const facts = isStudent ? data.class_label : [data.department, data.years_experience ? `${data.years_experience} years of experience` : ""].filter(Boolean).join(" · ");
  const chips: [string, string][] = [
    ["Town", data.city], ["Age", data.age ? String(data.age) : ""], ["Gender", GENDER[data.gender] ?? ""],
    ["Favourite subject", data.favorite_subject], ["Wants to become", data.career_goal], ["Qualification", data.qualification],
    ["Speaks", data.languages.join(", ")],
  ];
  const facts2 = chips.filter(([, v]) => v);
  const socials = SOCIAL_SITES.filter((x) => data.social_links[x.key]);
  const achievements = [...data.achievement_items].sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
  const skills = [...data.skills].sort((a, b) => b.level - a.level);
  const plainTalents = data.talents.filter((t) => !skills.some((s) => s.name.toLowerCase() === t.toLowerCase()));

  const hasProjects = data.project_list.length > 0 || !!data.projects;
  const hasAchievements = achievements.length > 0 || !!data.achievements;
  const hasSkills = skills.length > 0 || plainTalents.length > 0 || data.interests.length > 0 || data.learning.length > 0;
  const empty = !data.about && !data.background && !hasProjects && !hasAchievements && !hasSkills && !data.results && !data.attendance;

  const stats: { label: string; node: React.ReactNode; tone?: string }[] = [];
  if (data.results) stats.push({ label: "Overall result", node: <CountUp to={data.results.overall_percent} suffix="%" />, tone: data.results.overall_percent >= 60 ? "good" : data.results.overall_percent >= 40 ? "warn" : "bad" });
  if (data.attendance && data.attendance.percent !== null) stats.push({ label: "Attendance", node: <CountUp to={data.attendance.percent} suffix="%" />, tone: data.attendance.percent >= 75 ? "good" : "warn" });
  if (data.attendance && data.attendance.longest_streak > 0) stats.push({ label: "Best streak", node: <><CountUp to={data.attendance.longest_streak} /><small> days</small></> });
  if (data.project_list.length) stats.push({ label: data.project_list.length === 1 ? "Project" : "Projects", node: <CountUp to={data.project_list.length} /> });
  if (skills.length + plainTalents.length) stats.push({ label: "Skills", node: <CountUp to={skills.length + plainTalents.length} /> });
  if (achievements.length) stats.push({ label: achievements.length === 1 ? "Achievement" : "Achievements", node: <CountUp to={achievements.length} /> });

  const nav: [string, string][] = [];
  if (data.about) nav.push(["about", "About"]);
  if (hasSkills) nav.push(["skills", "Skills"]);
  if (hasProjects) nav.push(["projects", "Projects"]);
  if (data.results) nav.push(["results", "Results"]);
  if (data.attendance) nav.push(["attendance", "Attendance"]);
  if (hasAchievements) nav.push(["achievements", "Achievements"]);

  return (
    <div className="pp wrap">
      <nav className="crumbs pp-noprint" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{isStudent ? "Student" : "Teacher"} profile</span></nav>

      <header className="pp-hero">
        <div className="pp-cover" aria-hidden="true"><i /><i /><i /></div>
        <div className="pp-hero-body">
          <PersonPhoto name={data.full_name} src={data.photo} adjust={data.photo_adjust} size={132} className="pp-photo" />
          <div className="pp-who">
            <span className="pp-role">{isStudent ? "Student" : "Teacher"}</span>
            <h1>{data.full_name}</h1>
            {data.headline && <p className="pp-headline">{data.headline}</p>}
            {facts && <p className="pp-facts">{facts} · {SITE.nameFull}</p>}
            {socials.length > 0 && (
              <ul className="pp-social" aria-label="Social media">
                {socials.map((x) => (
                  <li key={x.key}><a href={data.social_links[x.key]} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={`${data.full_name} on ${x.label}`} title={x.label}><SocialIcon name={x.key} size={22} /></a></li>
                ))}
              </ul>
            )}
            <div className="pp-actions pp-noprint">
              <button type="button" className="btn btn-primary btn-sm" onClick={share}>Share profile</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>Save as PDF</button>
              {/^https:\/\//i.test(data.website) && <a className="btn btn-outline btn-sm" href={data.website} target="_blank" rel="noopener noreferrer nofollow ugc">Website ↗</a>}
            </div>
          </div>
        </div>
      </header>

      {stats.length > 0 && (
        <div className="pp-stats" role="list" data-reveal>
          {stats.map((s) => (
            <div className={`pp-stat${s.tone ? " tone-" + s.tone : ""}`} role="listitem" key={s.label}><b>{s.node}</b><span>{s.label}</span></div>
          ))}
        </div>
      )}

      {nav.length > 1 && (
        <nav className="pp-tabs pp-noprint" aria-label="Sections of this profile">
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{label}</a>)}
        </nav>
      )}

      {empty && <p className="pp-empty">{first} has not added more details yet.</p>}
      {data.quote && <blockquote className="pp-quote" data-reveal>“{data.quote}”</blockquote>}

      <div className="pp-cols">
        <div className="pp-main">
          {data.about && <Card id="about" title="About"><Para>{data.about}</Para></Card>}

          {hasProjects && (
            <Card id="projects" title="Projects">
              {data.project_list.length > 0 && (
                <ul className="pp-projects">
                  {data.project_list.map((p, i) => (
                    <li key={p.title + i} className="pp-project" style={{ ["--i" as string]: i }}>
                      <h3>{p.title}</h3>
                      {p.summary && <p>{p.summary}</p>}
                      {p.tags.length > 0 && <ul className="pp-ptags">{p.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
                      {/^https:\/\//i.test(p.link) && <a className="pp-plink" href={p.link} target="_blank" rel="noopener noreferrer nofollow ugc">{linkLabel(p.link)} <span aria-hidden="true">↗</span></a>}
                    </li>
                  ))}
                </ul>
              )}
              {data.projects && <Para>{data.projects}</Para>}
            </Card>
          )}

          {data.results && (
            <Card id="results" title="Results">
              <ResultsExplorer classes={data.results.classes} overall={data.results.overall_percent} topSubjects={data.results.top_subjects} />
              <p className="pp-note">Marks entered by the school. Shown because {first} chose to share them.</p>
            </Card>
          )}

          {data.attendance && (
            <Card id="attendance" title="Attendance & discipline">
              <div className="pp-att-stats">
                {data.attendance.percent !== null && <div><b>{data.attendance.percent}%</b><span>present</span></div>}
                <div><b>{data.attendance.present}</b><span>days present</span></div>
                <div><b>{data.attendance.absent}</b><span>days absent</span></div>
                <div><b>{data.attendance.current_streak}</b><span>day streak</span></div>
                <div><b>{data.attendance.longest_streak}</b><span>best streak</span></div>
                {data.attendance.homework && <div><b>{data.attendance.homework.percent}%</b><span>homework done</span></div>}
              </div>
              {data.attendance.total > 0 ? <AttendanceHeatmap data={data.attendance} /> : <p className="pp-note">No attendance has been marked in the last 12 months.</p>}
            </Card>
          )}

          {hasAchievements && (
            <Card id="achievements" title="Achievements & certificates">
              {achievements.length > 0 && (
                <ol className="pp-timeline">
                  {achievements.map((a, i) => (
                    <li key={a.title + i} className={`k-${a.kind}`}>
                      <span className="pp-tl-dot" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={KIND_PATH[a.kind]} /></svg></span>
                      <div>
                        <b>{a.title}</b>
                        <small>{KIND_LABEL[a.kind]}{a.year ? ` · ${a.year}` : ""}</small>
                        {a.detail && <p>{a.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {data.achievements && <Para>{data.achievements}</Para>}
            </Card>
          )}

          {data.background && <Card title="Background"><Para>{data.background}</Para></Card>}
        </div>

        <aside className="pp-side">
          {facts2.length > 0 && <Card title="Quick facts"><dl className="pp-facts-grid">{facts2.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl></Card>}

          {hasSkills && (
            <Card id="skills" title="Skills">
              {skills.length > 0 && (
                <ul className="pp-skills">
                  {skills.map((s, i) => (
                    <li key={s.name} style={{ ["--i" as string]: i }}>
                      <span className="pp-skill-top"><b>{s.name}</b><small>{LEVEL_WORD[s.level - 1]}</small></span>
                      <span className="pp-skill-bar" aria-hidden="true"><i style={{ ["--w" as string]: `${s.level * 20}%` }} /></span>
                    </li>
                  ))}
                </ul>
              )}
              {plainTalents.length > 0 && <><h3 className="pp-sub">Talents</h3><ul className="pp-tags">{plainTalents.map((t) => <li key={t}>{t}</li>)}</ul></>}
              {data.interests.length > 0 && <><h3 className="pp-sub">Interests</h3><ul className="pp-tags alt">{data.interests.map((t) => <li key={t}>{t}</li>)}</ul></>}
              {data.learning.length > 0 && <><h3 className="pp-sub">Currently learning</h3><ul className="pp-tags learn">{data.learning.map((t) => <li key={t}>{t}</li>)}</ul></>}
            </Card>
          )}
        </aside>
      </div>

      <p className="pp-foot">This page was written by {first} and is shown with their choice. Results and attendance come from the school's records and appear only because {first} switched them on. Only the school office can change name and class.</p>
    </div>
  );
}
