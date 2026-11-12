import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AdjustedImg } from "../components/media/AdjustedImg";
import { openLightbox } from "../components/media/lightboxStore";
import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkAchievements, SkArticle } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { api, ApiError } from "../lib/api";
import { usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { Achievement } from "../types/api";
import "./AchievementsPage.css";

const CATS = [
  { v: "ALL", l: "All" },
  { v: "ACADEMIC", l: "Academic" },
  { v: "SPORTS", l: "Sports" },
  { v: "ARTS", l: "Arts & culture" },
  { v: "OTHER", l: "Other" },
];

const CAT_ICON: Record<string, string> = {
  ACADEMIC: "M12 3 2 8l10 5 10-5-10-5ZM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5",
  SPORTS: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3",
  ARTS: "M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.6-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.4 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0 0 21 8.5C21 5.5 17 3 12 3Z",
  OTHER: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3Z",
};
const catLabel = (v: string) => CATS.find((c) => c.v === v)?.l ?? "Achievement";

/** Small picture (or a category icon), tag, two-line title and text — the whole card opens the achievement's own page. */
function AchCard({ a, i }: { a: Achievement; i: number }) {
  return (
    <Link to={`/achievements/${a.id}`} className={`ach2 cat-${a.category}`} data-reveal style={{ ["--d" as string]: i % 3 }}>
      <span className="ach2-thumb" aria-hidden="true">
        {a.image ? <AdjustedImg src={a.image} adjust={a.image_adjust} alt={a.title} /> : <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={CAT_ICON[a.category] ?? CAT_ICON.OTHER} /></svg>}
      </span>
      <span className="ach2-body">
        <span className="ach2-tag">{catLabel(a.category)}</span>
        <h3>{a.title}</h3>
        {a.description && <p>{a.description}</p>}
        <span className="ach2-more">Read more <i aria-hidden="true">→</i></span>
      </span>
    </Link>
  );
}

export function AchievementsPage() {
  usePageMeta("Achievements", `Results, awards and recognition earned by students of ${SITE.nameFull}.`);
  const { data, error, more, hasMore, busy } = usePaged<Achievement>("/content/achievements/public/", 30);
  const [cat, setCat] = useState("ALL");

  const byYear = useMemo(() => {
    const m = new Map<number, Achievement[]>();
    (data ?? []).filter((a) => cat === "ALL" || a.category === cat).forEach((a) => m.set(a.year, [...(m.get(a.year) ?? []), a]));
    return [...m.entries()].sort((a, b) => b[0] - a[0]);
  }, [data, cat]);

  return (
    <>
      <PageHero crumb="Achievements" eyebrow="Results & achievements" title="Proud moments, recorded." lede="Awards, results and recognition earned by our students and staff — added by the school office once confirmed." />
      <Section>
        {data === null ? (
          <SkAchievements count={6} />
        ) : data.length === 0 ? (
          <EmptyPanel icon="award" title={error ? "Achievements could not be loaded" : "Achievements will be published here"}>
            {error ?? "The school office adds each achievement after it has been confirmed, so nothing is listed that has not really happened. Please check back soon."}
          </EmptyPanel>
        ) : (
          <>
            <div className="filters" role="tablist" aria-label="Filter by category">
              {CATS.map((c) => (
                <button key={c.v} type="button" role="tab" aria-selected={cat === c.v} className={`chip-btn ${cat === c.v ? "on" : ""}`} onClick={() => setCat(c.v)}>
                  {c.l}
                </button>
              ))}
            </div>
            {byYear.length === 0 && <EmptyPanel title="Nothing in this category yet" />}
            {byYear.map(([year, items]) => (
              <div className="year-block" key={year}>
                <h2>{year}</h2>
                <div className="ach-grid">
                  {items.map((a, i) => <AchCard key={a.id} a={a} i={i} />)}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="load-more">
                <button type="button" className="btn btn-outline" onClick={more} disabled={busy}>
                  {busy ? "Loading…" : "Show more"}
                </button>
              </div>
            )}
          </>
        )}
      </Section>
    </>
  );
}


/** One achievement on its own page: /achievements/<id>. */
export function AchievementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [a, setA] = useState<Achievement | null>(null);
  const [more, setMore] = useState<Achievement[]>([]);
  const [failed, setFailed] = useState(false);
  const achDesc = a?.description?.replace(/\s+/g, " ").trim().slice(0, 155) || `An achievement of ${SITE.nameFull}.`;
  usePageMeta(
    a?.title ?? "Achievement",
    achDesc,
    undefined,
    a
      ? { crumbs: [{ name: "Home", path: "/" }, { name: "Achievements", path: "/achievements" }, { name: a.title, path: `/achievements/${a.id}` }] }
      : {},
  );

  useEffect(() => {
    let alive = true;
    // oxlint-disable-next-line react/set-state-in-effect
    setA(null);
    api.get<Achievement>(`/content/achievements/public/${id}/`, { auth: false }).then(
      (r) => alive && setA(r),
      (e) => alive && (e instanceof ApiError && e.status === 404 ? navigate("/achievements", { replace: true }) : setFailed(true)),
    );
    api.get<{ results: Achievement[] }>("/content/achievements/public/", { auth: false }).then((r) => alive && setMore(r.results), () => undefined);
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  const related = useMemo(() => (a ? more.filter((x) => x.id !== a.id).sort((x, y) => Number(y.category === a.category) - Number(x.category === a.category) || y.year - x.year).slice(0, 3) : []), [more, a]);

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: a?.title, url: window.location.href });
      else await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* closed the share sheet */
    }
  }

  return (
    <Section>
      <div className="detail ach-detail">
        <Link to="/achievements" className="back-link">← All achievements</Link>
        {failed ? (
          <EmptyPanel title="This achievement could not be loaded">Please check your connection and try again.</EmptyPanel>
        ) : !a ? (
          <SkArticle />
        ) : (
          <article className={`cat-${a.category}`}>
            {a.image && (
              <button type="button" className="ach-hero-pic" onClick={() => openLightbox({ src: a.image!, alt: a.title, caption: a.title })} aria-label="View the photo full size">
                <AdjustedImg src={a.image} adjust={a.image_adjust} alt={`${a.title} — achievement of Tufanganj Vivekananda Vidyalaya`} />
              </button>
            )}
            <div className="ach-detail-meta"><span className="ach2-tag">{catLabel(a.category)}</span><span className="ach-year">{a.year}</span></div>
            <h1 className="pg-title" style={{ fontSize: "clamp(30px,4.6vw,50px)", marginTop: 12 }}>{a.title}</h1>
            {a.description ? <div className="detail-body">{a.description}</div> : <p className="detail-body" style={{ color: "var(--fg-faint)" }}>No more details were added for this one.</p>}
            <div className="ach-detail-actions"><button type="button" className="btn btn-outline btn-sm" onClick={share}>Share</button></div>
          </article>
        )}
        {related.length > 0 && (
          <div className="ach-related">
            <h2>More proud moments</h2>
            <div className="ach-grid">{related.map((r, i) => <AchCard key={r.id} a={r} i={i} />)}</div>
          </div>
        )}
      </div>
    </Section>
  );
}
