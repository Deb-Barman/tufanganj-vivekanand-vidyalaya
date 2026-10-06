import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { Paginated, TeacherProfile } from "../types/api";
import "./Faculty.css";

export function Faculty() {
  const [teachers, setTeachers] = useState<TeacherProfile[] | null>(null);

  useEffect(() => {
    api
      .get<Paginated<TeacherProfile>>("/academics/teachers/public/", { auth: false })
      .then((data) => setTeachers(data.results))
      .catch((err) => {
        // Fail quiet on the public site — show the empty state rather
        // than an error banner for a section nobody's blocked on.
        void (err instanceof ApiError);
        setTeachers([]);
      });
  }, []);

  return (
    <section className="section" id="teachers">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <div className="eyebrow">
            <span className="num">03</span>Our Faculty
          </div>
          <h2>Thirty teachers. One staff room, many specialities.</h2>
          <p className="lede">Every subject on our timetable is taught by someone who studied it.</p>
        </div>

        {teachers === null && <p className="notice-loading">Loading…</p>}

        {teachers !== null && teachers.length === 0 && (
          <div className="todo-panel" data-reveal>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
              <path d="M12 9v4M12 16.5h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <div>
              <strong>Faculty directory — not populated yet</strong>
              <p>
                The pipeline is live: Super Admin creates a Teacher account, the teacher fills in their own
                department and bio from the portal's Faculty Directory module, and it appears here automatically.
                No teacher profiles have been entered in this project yet, so nothing is shown rather than invented.
              </p>
            </div>
          </div>
        )}

        {teachers !== null && teachers.length > 0 && (
          <div className="teacher-grid">
            {teachers.map((t, i) => (
              <article className="teacher-card lift" key={t.user} data-reveal style={{ ["--d" as string]: i % 4 }}>
                <h4>{t.full_name}</h4>
                {t.department && <span className="pill">{t.department}</span>}
                {t.bio && <p>{t.bio}</p>}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
