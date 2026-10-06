import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Article, Paginated } from "../types/api";
import "./BlogPage.css";

export function BlogPage() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Paginated<Article>>("/content/articles/public/", { auth: false })
      .then((data) => setArticles(data.results))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load articles."));
  }, []);

  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <div className="eyebrow">School Blog</div>
          <h2>News & articles from TVV.</h2>
        </div>

        {error && <p className="alert alert-error">{error}</p>}
        {!error && articles === null && <p className="notice-loading">Loading…</p>}
        {!error && articles !== null && articles.length === 0 && (
          <p className="notice-empty">No articles published yet.</p>
        )}
        {!error && articles !== null && articles.length > 0 && (
          <div className="blog-grid">
            {articles.map((a, i) => (
              <article className="blog-card lift" key={a.id} data-reveal style={{ ["--d" as string]: i % 3 }}>
                {a.cover_image && <img src={a.cover_image} alt="" className="blog-card-cover" />}
                <h3>{a.title}</h3>
                {a.excerpt && <p>{a.excerpt}</p>}
                <span className="blog-date">
                  {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
