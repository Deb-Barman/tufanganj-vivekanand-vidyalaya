import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Notice, Paginated } from "../types/api";
import "./NoticesSection.css";

export function NoticesSection() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Paginated<Notice> | Notice[]>("/notices/public/", { auth: false })
      .then((data) => {
        if (cancelled) return;
        setNotices(Array.isArray(data) ? data : data.results);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load notices right now.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="section" id="notices">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">
            <span className="num">06</span>Notice Board
          </div>
          <h2>Notices, live from the school office.</h2>
          <p className="lede">Published by the Super Admin from the portal — this list reflects real notices, not a demo.</p>
        </div>

        {error && <p className="alert alert-error">{error}</p>}

        {!error && notices === null && <p className="notice-loading">Loading notices…</p>}

        {!error && notices !== null && notices.length === 0 && (
          <p className="notice-empty">No notices have been posted yet.</p>
        )}

        {!error && notices !== null && notices.length > 0 && (
          <ul className="notice-list">
            {notices.map((notice) => (
              <li className="notice-item" key={notice.id}>
                <div className="notice-item-head">
                  <h4>{notice.title}</h4>
                  {notice.target_class && <span className="pill">{notice.target_class}</span>}
                </div>
                <p>{notice.body}</p>
                <span className="notice-date">
                  {new Date(notice.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
