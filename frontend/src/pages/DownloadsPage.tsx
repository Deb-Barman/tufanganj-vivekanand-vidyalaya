import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkRowCards } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { fmtLong, usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { SchoolForm } from "../types/api";

export function DownloadsPage() {
  usePageMeta("Downloads", `Forms and documents to download from ${SITE.nameFull}.`);
  const { data, error } = usePaged<SchoolForm>("/content/forms/public/", 50);
  return (
    <>
      <PageHero crumb="Downloads" eyebrow="Forms & documents" title="Download school forms." lede="Admission forms, certificates and other documents published by the school office." />
      <Section>
        {data === null ? (
          <SkRowCards count={4} variant="file" />
        ) : data.length === 0 ? (
          <EmptyPanel icon="file" title={error ? "Documents could not be loaded" : "No documents yet"}>{error ?? "Forms appear here as soon as the office uploads them."}</EmptyPanel>
        ) : (
          <div className="row-list">
            {data.map((f) => (
              <article className="row-card" key={f.id} data-reveal>
                <div className="date-badge" style={{ color: "var(--accent)" }}>
                  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4" /></svg>
                </div>
                <div className="row-body">
                  <h3>{f.title}</h3>
                  <div className="row-meta"><span>Added {fmtLong(f.created_at)}</span></div>
                </div>
                {f.file && (f.source === "link" ? (
                  <span className="row-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a className="btn btn-primary btn-sm" href={f.file} target="_blank" rel="noopener noreferrer">Open</a>
                    {f.download_url && <a className="btn btn-outline btn-sm" href={f.download_url} target="_blank" rel="noopener noreferrer">Download</a>}
                  </span>
                ) : (
                  <a className="btn btn-primary btn-sm" href={f.file} target="_blank" rel="noopener noreferrer" download>Download</a>
                ))}
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
