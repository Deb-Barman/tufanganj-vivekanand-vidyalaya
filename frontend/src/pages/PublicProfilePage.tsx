import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/site/Avatar";
import { Sk } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { api, ApiError } from "../lib/api";
import { usePageMeta } from "../lib/usePageMeta";
import type { PublicProfile } from "../types/api";
import "./PublicProfile.css";

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

const Block = ({ title, children }: { title: string; children: string }) => (
  <section className="pp-block">
    <h2>{title}</h2>
    <p>{children}</p>
  </section>
);

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
        <div className="pp-card"><Sk circle w={120} h={120} /><div style={{ flex: 1, display: "grid", gap: 12 }}><Sk w="60%" h={30} /><Sk w="40%" h={16} /><Sk w="80%" h={16} /></div></div>
        <Sk h={120} style={{ marginTop: 20 }} />
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

  const facts = data.role === "student" ? data.class_label : [data.department, data.years_experience ? `${data.years_experience} years of experience` : ""].filter(Boolean).join(" · ");
  const empty = !data.about && !data.background && !data.achievements && data.talents.length === 0 && data.interests.length === 0;
  return (
    <div className="pp wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{data.role === "student" ? "Student" : "Teacher"} profile</span></nav>
      <header className="pp-card">
        {data.photo ? <img className="pp-photo" src={data.photo} alt={`Photo of ${data.full_name}`} width={120} height={120} /> : <Avatar name={data.full_name} size={120} />}
        <div className="pp-who">
          <span className="pp-role">{data.role === "student" ? "Student" : "Teacher"}</span>
          <h1>{data.full_name}</h1>
          {data.headline && <p className="pp-headline">{data.headline}</p>}
          {facts && <p className="pp-facts">{facts} · {SITE.nameFull}</p>}
          <div className="pp-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={share}>Share</button>
            {/^https:\/\//i.test(data.website) && <a className="btn btn-outline btn-sm" href={data.website} target="_blank" rel="noopener noreferrer nofollow ugc">Website ↗</a>}
          </div>
        </div>
      </header>

      {empty && <p className="pp-empty">{data.full_name.split(" ")[0]} has not added more details yet.</p>}
      {data.about && <Block title="About">{data.about}</Block>}
      {data.background && <Block title="Background">{data.background}</Block>}
      {data.talents.length > 0 && (
        <section className="pp-block"><h2>Talents &amp; skills</h2><ul className="pp-tags">{data.talents.map((t) => <li key={t}>{t}</li>)}</ul></section>
      )}
      {data.interests.length > 0 && (
        <section className="pp-block"><h2>Interests</h2><ul className="pp-tags alt">{data.interests.map((t) => <li key={t}>{t}</li>)}</ul></section>
      )}
      {data.achievements && <Block title="Achievements">{data.achievements}</Block>}
      <p className="pp-foot">This page was written by {data.full_name.split(" ")[0]} and is shown with their choice. Only the school office can change their name and class.</p>
    </div>
  );
}
