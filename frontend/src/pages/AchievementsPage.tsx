import { useMemo, useState } from "react";
import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkCards } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { Achievement } from "../types/api";

const CATS = [
  { v: "ALL", l: "All" },
  { v: "ACADEMIC", l: "Academic" },
  { v: "SPORTS", l: "Sports" },
  { v: "ARTS", l: "Arts & culture" },
  { v: "OTHER", l: "Other" },
];

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
      <PageHero crumb="Achievements" eyebrow="Achievements" title="Proud moments, recorded." lede="Awards, results and recognition earned by our students and staff — added by the school office once confirmed." />
      <Section>
        {data === null ? (
          <SkCards count={6} />
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
                <div className="card-grid">
                  {items.map((a, i) => (
                    <article className="ach-card" key={a.id} data-reveal style={{ ["--d" as string]: i % 3 }}>
                      {a.image && <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                      <span className="pill">{CATS.find((c) => c.v === a.category)?.l}</span>
                      <h3>{a.title}</h3>
                      {a.description && <p>{a.description}</p>}
                    </article>
                  ))}
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
