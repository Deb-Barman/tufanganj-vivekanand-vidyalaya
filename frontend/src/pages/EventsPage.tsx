import { useMemo, useState } from "react";
import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkList } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { fmtDay, fmtLong, usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { EventItem } from "../types/api";

export function EventsPage() {
  usePageMeta("Events", `School calendar and events at ${SITE.nameFull}.`);
  const { data, error } = usePaged<EventItem>("/content/events/public/", 60);
  const [tab, setTab] = useState<"up" | "past">("up");
  const today = new Date().toLocaleDateString("en-CA");
  const lists = useMemo(() => {
    const all = data ?? [];
    return { up: all.filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date)), past: all.filter((e) => e.event_date < today).sort((a, b) => b.event_date.localeCompare(a.event_date)) };
  }, [data, today]);
  const shown = lists[tab];
  return (
    <>
      <PageHero crumb="Events" eyebrow="School calendar" title="What's happening at school." lede="Upcoming events, sports days, exams and celebrations." />
      <Section>
        <div className="filters" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "up"} className={`chip-btn ${tab === "up" ? "on" : ""}`} onClick={() => setTab("up")}>Upcoming{data ? ` (${lists.up.length})` : ""}</button>
          <button type="button" role="tab" aria-selected={tab === "past"} className={`chip-btn ${tab === "past" ? "on" : ""}`} onClick={() => setTab("past")}>Past{data ? ` (${lists.past.length})` : ""}</button>
        </div>
        {data === null ? (
          <SkList count={4} avatar={false} />
        ) : shown.length === 0 ? (
          <EmptyPanel icon="calendar" title={error ? "Events could not be loaded" : tab === "up" ? "No upcoming events" : "No past events"}>{error ?? (tab === "up" ? "New events are added to the calendar by the school office." : undefined)}</EmptyPanel>
        ) : (
          <div className="row-list">
            {shown.map((e) => {
              const d = fmtDay(e.event_date);
              return (
                <article className="row-card" key={e.id} data-reveal>
                  <div className="date-badge"><b>{d.day}</b><span>{d.mon}</span></div>
                  <div className="row-body">
                    <h3>{e.title}</h3>
                    {e.description && <p>{e.description}</p>}
                    <div className="row-meta"><span>{fmtLong(e.event_date)}</span>{e.audience && <span className="pill">{e.audience}</span>}</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
