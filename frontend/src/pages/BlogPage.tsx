import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkArticle, SkCards, Spinner } from "../components/loading/Loading";
import { api, ApiError } from "../lib/api";
import { AdjustedImg } from "../components/media/AdjustedImg";
import { openLightbox } from "../components/media/lightboxStore";
import { SITE } from "../config/site";
import { fmtLong, usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { Article } from "../types/api";

export function BlogPage() {
  usePageMeta("Blog", `News and stories from ${SITE.nameFull}.`);
  const { data, error, more, hasMore, busy } = usePaged<Article>("/content/articles/public/", 9);
  return (
    <>
      <PageHero crumb="Blog" eyebrow="School blog" title="Stories from school life." lede="News, events and articles written by the school." />
      <Section>
        {data === null ? (
          <SkCards count={6} />
        ) : data.length === 0 ? (
          <EmptyPanel icon="file" title={error ? "Articles could not be loaded" : "No articles published yet"}>{error ?? "New stories appear here as soon as they are published."}</EmptyPanel>
        ) : (
          <div className="post-grid">
            {data.map((a, i) => (
              <Link key={a.id} to={`/blog/${a.slug}`} className="post-card" data-reveal style={{ ["--d" as string]: i % 3 }}>
                <div className="post-cover">{a.cover_image ? <AdjustedImg src={a.cover_image} adjust={a.cover_adjust} alt="" /> : <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10" /></svg>}</div>
                <div className="post-body">
                  <h3>{a.title}</h3>
                  {a.excerpt && <p>{a.excerpt}</p>}
                  <div className="row-meta"><span>{fmtLong(a.created_at)}</span><span style={{ color: "var(--accent)", fontWeight: 700 }}>Read →</span></div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {hasMore && (
          <div className="load-more">
            <button type="button" className="btn btn-outline" onClick={more} disabled={busy}>
              {busy ? <><Spinner /> Loading…</> : "Show more articles"}
            </button>
          </div>
        )}
      </Section>
    </>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Article | null>(null);
  const [failed, setFailed] = useState(false);
  usePageMeta(post?.title ?? "Article", post?.excerpt || post?.body.slice(0, 150) || "School article");

  useEffect(() => {
    api.get<Article>(`/content/articles/public/${encodeURIComponent(slug ?? "")}/`, { auth: false }).then(setPost).catch((e) => (e instanceof ApiError && e.status === 404 ? navigate("/blog", { replace: true }) : setFailed(true)));
  }, [slug, navigate]);

  return (
    <Section>
      <div className="detail">
        <Link to="/blog" className="back-link">← All articles</Link>
        {failed ? (
          <EmptyPanel title="This article could not be loaded">Please check your connection and try again.</EmptyPanel>
        ) : !post ? (
          <SkArticle />
        ) : (
          <article>
            <div className="eyebrow">Blog · {fmtLong(post.created_at)}</div>
            <h1 className="pg-title" style={{ fontSize: "clamp(32px,5vw,54px)", marginTop: 12 }}>{post.title}</h1>
            {post.cover_image && (
              <button type="button" className="detail-cover-btn" onClick={() => openLightbox({ src: post.cover_image!, alt: post.title, caption: post.title })} aria-label="View the cover picture full screen">
                <img className="detail-cover" src={post.cover_image} alt="" referrerPolicy="no-referrer" />
              </button>
            )}
            <div className="detail-body">{post.body}</div>
          </article>
        )}
      </div>
    </Section>
  );
}
