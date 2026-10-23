import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { AdminStats } from "../../types/api";
import { AdminOverviewSkeleton } from "../ui/Skeletons";
import { AttendanceBars, EmptyState, Icon, Ring, StatCard, StatusPill, errText, firstName, fmtDate, greeting, todayLong } from "../ui/kitExports";
import { dashPath } from "../ui/nav";
import { StudentOverview, TeacherOverview } from "./RoleOverviews";
import type { IconName } from "../ui/icons";


export function OverviewPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "SUPER_ADMIN") return <AdminOverview name={user.full_name} />;
  if (user.role === "TEACHER") return <TeacherOverview name={user.full_name} />;
  return <StudentOverview name={user.full_name} />;
}

/* ───────────── Super Admin command centre ───────────── */

function AdminOverview({ name }: { name: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    api.get<AdminStats>("/auth/admin/stats/").then(setStats).catch((e) => setError(errText(e, "Could not load the statistics.")));
  }, [attempt]);

  const attention: { icon: IconName; tone: string; title: string; text: string; to: string }[] = [];
  if (stats) {
    if (stats.admissions.pending > 0) attention.push({ icon: "inbox", tone: "warn", title: `${stats.admissions.pending} new admission ${stats.admissions.pending === 1 ? "enquiry" : "enquiries"}`, text: "Waiting for a reply from the office", to: "admissions" });
    if (stats.password_requests > 0) attention.push({ icon: "lock", tone: "bad", title: `${stats.password_requests} forgot-password ${stats.password_requests === 1 ? "request" : "requests"}`, text: "Someone cannot sign in — set them a new password", to: "accounts" });
    if (stats.people.students_without_class > 0) attention.push({ icon: "cap", tone: "bad", title: `${stats.people.students_without_class} ${stats.people.students_without_class === 1 ? "student has" : "students have"} no class`, text: "Assign a class so attendance and marks work", to: "students" });
    if (stats.content.articles_drafts > 0) attention.push({ icon: "book", tone: "accent", title: `${stats.content.articles_drafts} draft ${stats.content.articles_drafts === 1 ? "article" : "articles"}`, text: "Unpublished — not visible on the website", to: "blog" });
    if (stats.academics.classes === 0) attention.push({ icon: "layers", tone: "warn", title: "No classes set up yet", text: "Create a session, classes and subjects first", to: "academics" });
    else if (stats.attendance.today.marked === 0 && stats.people.students > 0) attention.push({ icon: "checkCircle", tone: "warn", title: "Attendance not marked today", text: "Mark it in a few taps", to: "attendance" });
  }

  const adm = stats?.admissions;
  const att = stats?.attendance.today;
  const attPct = att && att.marked > 0 ? Math.round((att.present / att.marked) * 100) : 0;

  return (
    <>
      <section className="hero-card">
        <div className="hero-eyebrow">
          <Icon name="sparkle" size={14} /> Command centre{stats?.academics.current_session ? ` · Session ${stats.academics.current_session}` : ""}
        </div>
        <h1>
          {greeting()}, {firstName(name)}.
        </h1>
        <p>{todayLong()}. Everything the school runs on — admissions, attendance, results, content and accounts — is one tap away.</p>
        <div className="hero-chips">
          <Link className="chip" to={dashPath("notices")}>
            <Icon name="megaphone" size={16} /> Post a notice
          </Link>
          <Link className="chip" to={dashPath("attendance")}>
            <Icon name="checkCircle" size={16} /> Mark attendance
          </Link>
          <Link className="chip" to={dashPath("admissions")}>
            <Icon name="inbox" size={16} /> Admissions {adm && adm.pending > 0 && <span className="dot" />}
          </Link>
          <Link className="chip" to={dashPath("accounts")}>
            <Icon name="users" size={16} /> New account
          </Link>
        </div>
      </section>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 18, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 220px" }}>{error}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Try again</button>
        </div>
      )}

      {!stats && !error && <AdminOverviewSkeleton />}

      {stats && (
        <>
          <div className="kpi-grid">
            <StatCard icon="cap" label="Students" value={stats.people.students} note={`${stats.people.students_without_class} without a class`} to={dashPath("students")} />
            <StatCard icon="school" label="Teachers" value={stats.people.teachers} note="Active faculty accounts" tone="good" to={dashPath("teachers")} />
            <StatCard icon="inbox" label="Pending enquiries" value={stats.admissions.pending} note={`${stats.admissions.total} received in total`} tone={stats.admissions.pending ? "warn" : "good"} to={dashPath("admissions")} />
            <StatCard icon="calendar" label="Upcoming events" value={stats.content.events_upcoming} note={`${stats.content.notices} ${stats.content.notices === 1 ? "notice" : "notices"} published`} to={dashPath("events")} />
          </div>

          <div className="grid-3">
            <section className="panel">
              <div className="panel-title">
                <h2>
                  <Icon name="alert" size={18} /> Needs your attention
                </h2>
              </div>
              {attention.length === 0 ? (
                <div className="all-clear">
                  <Icon name="checkCircle" /> All clear — nothing is waiting on you.
                </div>
              ) : (
                <div className="list">
                  {attention.map((a) => (
                    <Link key={a.to} to={dashPath(a.to)} className={`row-link tone-${a.tone}`}>
                      <span className="row-icon">
                        <Icon name={a.icon} size={19} />
                      </span>
                      <span className="row-main">
                        <strong>{a.title}</strong>
                        <span>{a.text}</span>
                      </span>
                      <Icon name="chevronRight" size={18} />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-title">
                <h2>
                  <Icon name="checkCircle" size={18} /> Today's attendance
                </h2>
                <Link className="panel-link" to={dashPath("attendance")}>
                  Open <Icon name="arrowRight" size={14} />
                </Link>
              </div>
              {att && att.marked > 0 ? (
                <div className="split">
                  <Ring percent={attPct} label={`${attPct}%`} sub="present" tone={attPct >= 85 ? "good" : attPct >= 70 ? "warn" : "bad"} />
                  <div className="split-text">
                    <span>
                      <b>{att.present}</b> present
                    </span>
                    <span>
                      <b>{att.absent}</b> absent
                    </span>
                    <span>{att.marked} students marked</span>
                  </div>
                </div>
              ) : (
                <EmptyState icon="clock" title="Not marked yet" text="Attendance for today hasn't been recorded." />
              )}
            </section>
          </div>

          <div className="grid-2" style={{ marginTop: 20 }}>
            <section className="panel">
              <div className="panel-title">
                <h2>
                  <Icon name="trend" size={18} /> Last 7 days
                </h2>
              </div>
              <AttendanceBars days={stats.attendance.last7} />
              <div className="legend">
                <span>
                  <i style={{ background: "var(--good)" }} />
                  Present
                </span>
                <span>
                  <i style={{ background: "var(--danger)" }} />
                  Absent
                </span>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <h2>
                  <Icon name="inbox" size={18} /> Admissions pipeline
                </h2>
                <Link className="panel-link" to={dashPath("admissions")}>
                  Review <Icon name="arrowRight" size={14} />
                </Link>
              </div>
              {adm && adm.total > 0 ? (
                <>
                  <div className="pipeline" aria-label="Admissions by status">
                    <span className="p-pending" style={{ flex: adm.pending }} />
                    <span className="p-contacted" style={{ flex: adm.contacted }} />
                    <span className="p-closed" style={{ flex: adm.closed }} />
                  </div>
                  <div className="legend">
                    <span>
                      <i style={{ background: "var(--warn)" }} />
                      Pending {adm.pending}
                    </span>
                    <span>
                      <i style={{ background: "var(--accent)" }} />
                      Contacted {adm.contacted}
                    </span>
                    <span>
                      <i style={{ background: "var(--good)" }} />
                      Closed {adm.closed}
                    </span>
                  </div>
                  <div className="list" style={{ marginTop: 16 }}>
                    {stats.recent_admissions.map((a) => (
                      <Link key={a.id} to={dashPath("admissions")} className="row-link">
                        <span className="row-main">
                          <strong>{a.applicant_name}</strong>
                          <span>
                            {a.applying_for_class} · {fmtDate(a.submitted_at)}
                          </span>
                        </span>
                        <StatusPill tone={a.status === "PENDING" ? "warn" : a.status === "CONTACTED" ? "info" : "good"}>{a.status.toLowerCase()}</StatusPill>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState title="No enquiries yet" text="Enquiries from the website's admission form appear here." />
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

