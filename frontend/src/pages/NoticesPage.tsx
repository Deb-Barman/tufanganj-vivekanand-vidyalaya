import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkArticle, SkNotices, Spinner } from "../components/loading/Loading";
import { api, ApiError } from "../lib/api";
import { SITE } from "../config/site";
import { fmtDay, fmtLong, usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { Notice } from "../types/api";

export function NoticesPage() {
  usePageMeta("Notices", `Official notices and announcements from ${SITE.nameFull}.`);
  const { data, error, more, hasMore, busy } = usePaged<Notice>("/notices/public/", 15);
  const [q, setQ] = useState("");
  const shown = useMemo(() => (data ?? []).filter((n) => !q.trim() || `${n.title} ${n.body}`.toLowerCase().includes(q.trim().toLowerCase())), [data, q]);

  return (
    <>
      <PageHero crumb="Notices" eyebrow="Notice board" title="Notices from the school office." lede="Official announcements, newest first. Every notice has its own link you can share." />
      <Section>
        <div className="filters">
          <div className="search-field">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.5-4.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notices" aria-label="Search notices" />
          </div>
        </div>
        {data === null ? (
          <SkNotices count={4} />
        ) : shown.length === 0 ? (
          <EmptyPanel icon="file" title={error ? "Notices could not be loaded" : q ? "No notice matches your search" : "No notices yet"}>
            {error ?? (q ? "Try a different word." : "New announcements appear here as soon as the office posts them.")}
          </EmptyPanel>
        ) : (
          <div className="row-list">
            {shown.map((n) => {
              const d = fmtDay(n.created_at);
              return (
                <Link key={n.id} to={`/notices/${n.id}`} className="row-card" data-reveal>
                  <div className="date-badge"><b>{d.day}</b><span>{d.mon}</span></div>
                  <div className="row-body">
                    <h3>{n.title}</h3>
                    <p>{n.body}</p>
                    <div className="row-meta">
                      <span>{fmtLong(n.created_at)}</span>
                      {n.target_class && <span className="pill">For {n.target_class}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {hasMore && !q && (
          <div className="load-more">
            <button type="button" className="btn btn-outline" onClick={more} disabled={busy}>
              {busy ? <><Spinner /> Loading…</> : "Show older notices"}
            </button>
          </div>
        )}
      </Section>
    </>
  );
}

export function NoticeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [failed, setFailed] = useState(false);
  usePageMeta(notice?.title ?? "Notice", notice?.body.slice(0, 150) ?? "School notice");

  useEffect(() => {
    api.get<Notice>(`/notices/public/${id}/`, { auth: false }).then(setNotice).catch((e) => (e instanceof ApiError && e.status === 404 ? navigate("/notices", { replace: true }) : setFailed(true)));
  }, [id, navigate]);

  return (
    <Section>
      <div className="detail">
        <Link to="/notices" className="back-link">← All notices</Link>
        {failed ? (
          <EmptyPanel title="This notice could not be loaded">Please check your connection and try again.</EmptyPanel>
        ) : !notice ? (
          <SkArticle />
        ) : (
          <article>
            <div className="eyebrow">Notice · {fmtLong(notice.created_at)}</div>
            <h1 className="pg-title" style={{ fontSize: "clamp(30px,4.6vw,48px)", marginTop: 12 }}>{notice.title}</h1>
            {notice.target_class && <span className="pill" style={{ marginTop: 10 }}>For {notice.target_class}</span>}
            <div className="detail-body">{notice.body}</div>
          </article>
        )}
      </div>
    </Section>
  );
}
