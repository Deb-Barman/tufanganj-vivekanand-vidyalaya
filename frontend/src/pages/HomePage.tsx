import { Link } from "react-router-dom";
import { Hero } from "../components/Hero";
import { TrustBar } from "../components/TrustBar";
import { Section } from "../components/site/PageHero";
import { SkList, Spinner } from "../components/loading/Loading";
import { MORE, NAV, SITE } from "../config/site";
import { fmtDay, usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { Notice } from "../types/api";
import { ICONS } from "../components/site/icons";

const EXPLORE = [...NAV.filter((n) => n.to !== "/admissions" && n.to !== "/contact"), MORE[0], MORE[2]];

export function HomePage() {
  usePageMeta("", `${SITE.nameFull} — a Higher Secondary school in Tufanganj, Cooch Behar, West Bengal. Class V to XII, Science and Arts. Notices, admissions and the student portal.`, "/");
  const notices = usePaged<Notice>("/notices/public/", 3);

  return (
    <>
      <Hero />
      <TrustBar />

      <Section>
        <div className="section-head" data-reveal>
          <div className="eyebrow">Explore the school</div>
          <h2>Everything in one place.</h2>
          <p className="lede">Each page has its own address, so you can bookmark and share exactly what you need.</p>
        </div>
        <div className="explore-grid">
          {EXPLORE.map((n, i) => (
            <Link key={n.to} to={n.to} className="feature" data-reveal style={{ ["--d" as string]: i % 4 }}>
              <span className="f-icon">{ICONS[n.to] ?? ICONS["/about"]}</span>
              <h3>{n.label}</h3>
              <p>{n.desc}</p>
              <span className="go">Open →</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section>
        <div className="split-2" style={{ alignItems: "end", marginBottom: 22 }}>
          <div>
            <div className="eyebrow">Notice board</div>
            <h2 className="pg-title">Latest from the school office</h2>
          </div>
          <div style={{ justifySelf: "end" }}>
            <Link to="/notices" className="btn btn-outline btn-sm">
              All notices →
            </Link>
          </div>
        </div>
        {notices.data === null ? (
          <SkList count={3} avatar={false} />
        ) : notices.data.length === 0 ? (
          <p className="pg-sub">No notices have been published yet. New announcements appear here as soon as the office posts them.</p>
        ) : (
          <div className="row-list">
            {notices.data.map((n) => {
              const d = fmtDay(n.created_at);
              return (
                <Link key={n.id} to={`/notices/${n.id}`} className="row-card" data-reveal>
                  <div className="date-badge">
                    <b>{d.day}</b>
                    <span>{d.mon}</span>
                  </div>
                  <div className="row-body">
                    <h3>{n.title}</h3>
                    <p>{n.body}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {notices.busy && <Spinner />}
      </Section>

      <Section>
        <div className="cta-band" data-reveal>
          <div>
            <h2>Ready to join {SITE.short}?</h2>
            <p>Send an admission enquiry in two minutes, or write to the school office with any question.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/admissions" className="btn btn-primary">
              Start admission enquiry
            </Link>
            <Link to="/contact" className="btn btn-outline">
              Contact the office
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
