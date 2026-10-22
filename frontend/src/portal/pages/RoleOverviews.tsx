import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { AcademicSession, Attendance, Exam, Homework, Notice, Result, SchoolClass, Subject, TimetableEntry } from "../../types/api";
import { EmptyState, Icon, Ring, Skeleton, StatCard, fmtTime, firstName, greeting, listAll, todayISO, todayLong, useUI } from "../ui/kitExports";
import { useLoad } from "../ui/useLoad";
import { MemberOverviewSkeleton } from "../ui/Skeletons";
import { dashPath } from "../ui/nav";

const weekdayIndex = () => (new Date().getDay() === 0 ? -1 : new Date().getDay() - 1); // Sunday: no classes
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const nowMinutes = () => new Date().getHours() * 60 + new Date().getMinutes();

/** Today's periods as a list with the current period highlighted. */
function TodayList({ rows, showClass, classes }: { rows: TimetableEntry[]; showClass?: boolean; classes?: SchoolClass[] }) {
  const now = nowMinutes();
  return (
    <div className="list">
      {rows.map((r) => {
        const live = now >= minutes(r.start_time) && now < minutes(r.end_time);
        const over = now >= minutes(r.end_time);
        const brk = !r.subject;
        const cname = classes?.find((c) => c.id === r.school_class)?.name;
        return (
          <div key={r.id} className={`row-link ${live ? "tone-good" : ""}`} style={{ opacity: over ? 0.55 : 1, ...(live ? { boxShadow: "var(--inset-sm), 0 0 0 1px var(--good)" } : {}) }}>
            <span className="row-icon" style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14 }}>{r.period}</span>
            <span className="row-main">
              <strong>{brk ? r.label : r.subject_name}{showClass && cname ? ` · ${cname}` : ""}</strong>
              <span>{fmtTime(r.start_time)} – {fmtTime(r.end_time)}{!showClass && r.teacher_name ? ` · ${r.teacher_name}` : ""}{r.room ? ` · Room ${r.room}` : ""}</span>
            </span>
            {live && <span className="status-pill tone-good">now</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Shown in a panel whose request failed: honest message + a way to try again (never a fake "nothing here"). */
function RetryState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon="alert"
      title="Could not load this"
      text="The school server may be waking up, or your connection dropped."
      action={<button type="button" className="btn btn-outline btn-sm" onClick={onRetry}><Icon name="refresh" size={15} /> Try again</button>}
    />
  );
}

function NoticeList({ notices, failed, onRetry }: { notices: Notice[] | null; failed?: boolean; onRetry?: () => void }) {
  if (failed && onRetry) return <RetryState onRetry={onRetry} />;
  if (notices === null) return <Skeleton rows={3} />;
  if (notices.length === 0) return <EmptyState icon="megaphone" title="No notices" text="Official announcements appear here." />;
  return (
    <div className="list">
      {notices.slice(0, 4).map((n) => (
        <Link key={n.id} to={dashPath("notices")} className="row-link">
          <span className="row-icon"><Icon name="megaphone" size={18} /></span>
          <span className="row-main"><strong>{n.title}</strong><span>{new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
          <Icon name="chevronRight" size={17} />
        </Link>
      ))}
    </div>
  );
}

/* ───────────── Teacher ───────────── */

export function TeacherOverview({ name }: { name: string }) {
  const { user } = useAuth();
  const mineQ = useLoad(() => listAll<TimetableEntry>("/academics/timetable/?mine=1"));
  const classesQ = useLoad(() => listAll<SchoolClass>("/academics/classes/"));
  const studentsQ = useLoad(() => api.get<{ count: number }>("/academics/students/?page_size=1").then((r) => r.count));
  const homeworkQ = useLoad(() => listAll<Homework>("/academics/homework/"));
  const noticesQ = useLoad(() => listAll<Notice>("/notices/"));
  const mine = mineQ.data;
  const classes = classesQ.data ?? [];
  const students = studentsQ.data;
  const homework = homeworkQ.data;
  const notices = noticesQ.data;
  const [unmarked, setUnmarked] = useState<number | null>(null);

  const today = useMemo(() => (mine ?? []).filter((r) => r.weekday === weekdayIndex()).sort((a, b) => a.period - b.period), [mine]);
  const classIds = useMemo(() => [...new Set(today.map((r) => r.school_class))], [today]);

  // For each class taught today: has attendance been marked yet?
  useEffect(() => {
    if (mine === null || classIds.length === 0) return;
    Promise.all(classIds.map((id) => api.get<{ count: number }>(`/academics/attendance/?date=${todayISO()}&school_class=${id}&page_size=1`).then((r) => r.count > 0).catch(() => true)))
      .then((marked) => setUnmarked(marked.filter((m) => !m).length));
  }, [mine, classIds]);

  const unmarkedN = classIds.length === 0 ? 0 : unmarked;
  // Show the page only once EVERYTHING has settled (loaded or failed) so panels never pop in one by one.
  const ready = [mineQ, classesQ, studentsQ, homeworkQ, noticesQ].every((q) => q.status !== "loading") && !(classIds.length > 0 && unmarked === null);
  const now = nowMinutes();
  const done = today.filter((r) => now >= minutes(r.end_time)).length;
  const pct = today.length ? Math.round((done / today.length) * 100) : 0;
  const mineHw = (homework ?? []).filter((h) => h.created_by === user?.id);
  const active = mineHw.filter((h) => h.due_date >= todayISO()).length;

  return (
    <>
      <section className="hero-card">
        <div className="hero-eyebrow"><Icon name="school" size={14} /> Teacher desk</div>
        <div className="split" style={{ justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: "1 1 320px" }}>
            <h1>{greeting()}, {firstName(name)}.</h1>
            <p>{todayLong()}.{" "}{mineQ.status === "error" ? "Could not load your timetable." : mine === null ? "Loading your day…" : today.length > 0 ? `You have ${today.length} ${today.length === 1 ? "period" : "periods"} today across ${classIds.length} ${classIds.length === 1 ? "class" : "classes"}.` : "You have no periods scheduled today."}</p>
            <div className="hero-chips">
              <Link className="chip" to={dashPath("attendance")}><Icon name="checkCircle" size={16} /> Take attendance {unmarkedN ? <span className="dot" /> : null}</Link>
              <Link className="chip" to={dashPath("homework")}><Icon name="clipboard" size={16} /> Set homework</Link>
              <Link className="chip" to={dashPath("results")}><Icon name="award" size={16} /> Enter marks</Link>
            </div>
          </div>
          {ready && today.length > 0 && <Ring percent={pct} label={`${done}/${today.length}`} sub="periods done" tone="good" />}
        </div>
      </section>

      {!ready ? <MemberOverviewSkeleton /> : (
      <div className="ov-in">
      <div className="kpi-grid">
        <StatCard loading={mineQ.status === "loading"} error={mineQ.status === "error"} icon="layers" label="Classes today" value={classIds.length} note={`${today.length} periods`} to={dashPath("timetable")} />
        <StatCard loading={mineQ.status === "loading" || (mineQ.status === "ok" && classIds.length > 0 && unmarked === null)} error={mineQ.status === "error"} icon="checkCircle" label="Attendance to mark" value={unmarkedN ?? 0} note={unmarkedN ? "Not yet recorded today" : "All recorded"} tone={unmarkedN ? "warn" : "good"} to={dashPath("attendance")} />
        <StatCard loading={homeworkQ.status === "loading"} error={homeworkQ.status === "error"} icon="clipboard" label="Homework active" value={active} note={`${mineHw.length} set by you`} to={dashPath("homework")} />
        <StatCard loading={studentsQ.status === "loading"} error={studentsQ.status === "error"} icon="cap" label="Students" value={students ?? 0} note="Across the school" tone="good" to={dashPath("students")} />
      </div>

      <div className="grid-3">
        <section className="panel">
          <div className="panel-title"><h2><Icon name="clock" size={18} /> Today's schedule</h2><Link className="panel-link" to={dashPath("timetable")}>Week <Icon name="arrowRight" size={14} /></Link></div>
          {mineQ.status === "error" ? <RetryState onRetry={mineQ.reload} /> : mine === null ? <Skeleton rows={4} /> : today.length === 0 ? <EmptyState icon="clock" title="No periods today" text="Periods assigned to you by the school office appear here." /> : <TodayList rows={today} showClass classes={classes} />}
        </section>
        <section className="panel">
          <div className="panel-title"><h2><Icon name="megaphone" size={18} /> Notices</h2><Link className="panel-link" to={dashPath("notices")}>All <Icon name="arrowRight" size={14} /></Link></div>
          <NoticeList notices={notices} failed={noticesQ.status === "error"} onRetry={noticesQ.reload} />
        </section>
      </div>
      </div>
      )}
    </>
  );
}

/* ───────────── Student ───────────── */

function MonthCalendar({ records }: { records: Attendance[] }) {
  const [offset, setOffset] = useState(0);
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + offset);
  const y = base.getFullYear(), m = base.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const byDay = new Map(records.filter((r) => r.date.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)).map((r) => [Number(r.date.slice(8, 10)), r.status]));
  const todayN = offset === 0 ? new Date().getDate() : -1;
  return (
    <div>
      <div className="panel-title" style={{ marginBottom: 10 }}>
        <button type="button" className="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="Previous month"><Icon name="chevronRight" size={16} style={{ transform: "rotate(180deg)" }} /></button>
        <strong style={{ fontSize: 14 }}>{base.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong>
        <button type="button" className="icon-btn" disabled={offset >= 0} onClick={() => setOffset(offset + 1)} aria-label="Next month"><Icon name="chevronRight" size={16} /></button>
      </div>
      <div className="cal" role="grid" aria-label="Attendance calendar">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="cal-h">{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const n = i + 1, st = byDay.get(n);
          return <span key={n} className={`cal-d ${st === "PRESENT" ? "p" : st === "ABSENT" ? "a" : ""} ${n === todayN ? "t" : ""}`} title={st?.toLowerCase()}>{n}</span>;
        })}
      </div>
      <div className="legend"><span><i style={{ background: "var(--good)" }} />Present</span><span><i style={{ background: "var(--danger)" }} />Absent</span></div>
    </div>
  );
}

export function StudentOverview({ name }: { name: string }) {
  const { toast } = useUI();
  const attQ = useLoad(() => listAll<Attendance>("/academics/attendance/"));
  const sessionsQ = useLoad(() => listAll<AcademicSession>("/academics/sessions/"));
  const resultsQ = useLoad(() => listAll<Result>("/academics/results/"));
  const subjectsQ = useLoad(() => listAll<Subject>("/academics/subjects/"));
  const ttQ = useLoad(() => listAll<TimetableEntry>("/academics/timetable/"));
  const hwQ = useLoad(() => listAll<Homework>("/academics/homework/?upcoming=1"));
  const examsQ = useLoad(() => listAll<Exam>("/academics/exams/?upcoming=1"));
  const noticesQ = useLoad(() => listAll<Notice>("/notices/"));
  const att = attQ.data;
  const results = resultsQ.data;
  const subjectList = subjectsQ.data;
  const tt = ttQ.data;
  const hw = hwQ.data;
  const exams = examsQ.data;
  const notices = noticesQ.data;
  // optimistic tick-off keeps its own copy so a toggled checkbox is not overwritten by a reload
  const [hwLocal, setHwLocal] = useState<Record<string, boolean>>({});

  async function tick(h: Homework) {
    const done = !(hwLocal[h.id] ?? h.done);
    setHwLocal((p) => ({ ...p, [h.id]: done }));
    try { await api.post(`/academics/homework/${h.id}/done/`, { done }); } catch { setHwLocal((p) => ({ ...p, [h.id]: !done })); toast("error", "Could not update."); }
  }

  const present = att?.filter((a) => a.status === "PRESENT").length ?? 0;
  const attPct = att && att.length ? Math.round((present / att.length) * 100) : 0;
  // The Super Admin sets the working days of the whole session (e.g. 200): show "5 of 200", not "5 of 6 days held so far".
  const sessionDays = sessionsQ.data?.find((s) => s.is_current)?.working_days ?? null;
  const attNote = att ? (sessionDays ? `${present} of ${sessionDays} days${att.length ? ` · ${att.length} held so far` : ""}` : `${present} of ${att.length} days`) : "";
  const today = (tt ?? []).filter((r) => r.weekday === weekdayIndex()).sort((a, b) => a.period - b.period);
  const hwList = (hw ?? []).map((h) => ({ ...h, done: hwLocal[h.id] ?? h.done }));
  const pending = hwList.filter((h) => !h.done);
  const nextExam = exams?.[0];
  const bySubject = useMemo(() => {
    const m = new Map<string, { got: number; full: number }>();
    results?.forEach((r) => { const c = m.get(r.subject) ?? { got: 0, full: 0 }; c.got += Number(r.marks_obtained); c.full += Number(r.full_marks); m.set(r.subject, c); });
    return [...m.entries()].map(([id, v]) => ({ name: subjectList?.find((s) => s.id === id)?.name ?? "Subject", pct: v.full ? Math.round((v.got / v.full) * 100) : 0 })).sort((a, b) => b.pct - a.pct);
  }, [results, subjectList]);
  const avg = bySubject.length ? Math.round(bySubject.reduce((a, b) => a + b.pct, 0) / bySubject.length) : 0;
  const tone = (p: number) => (p >= 60 ? "good" : p >= 40 ? "warn" : "bad");
  // Show the page only once EVERYTHING has settled (loaded or failed) so panels never pop in one by one.
  const ready = [attQ, resultsQ, subjectsQ, ttQ, hwQ, examsQ, noticesQ].every((q) => q.status !== "loading");

  return (
    <>
      <section className="hero-card">
        <div className="hero-eyebrow"><Icon name="cap" size={14} /> Student portal</div>
        <div className="split" style={{ justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: "1 1 320px" }}>
            <h1>{greeting()}, {firstName(name)}.</h1>
            <p>{todayLong()}.{" "}{tt === null ? "" : today.length > 0 ? `${today.length} periods today${nextExam ? ` · next exam: ${nextExam.name}, ${nextExam.subject_name}` : ""}.` : nextExam ? `Next exam: ${nextExam.name}, ${nextExam.subject_name}.` : "Have a great day."}</p>
            <div className="hero-chips">
              <Link className="chip" to={dashPath("timetable")}><Icon name="clock" size={16} /> Timetable</Link>
              <Link className="chip" to={dashPath("homework")}><Icon name="clipboard" size={16} /> Homework {pending.length > 0 && <span className="dot" />}</Link>
              <Link className="chip" to={dashPath("results")}><Icon name="award" size={16} /> My results</Link>
            </div>
          </div>
          {ready && att && att.length > 0 && <Ring percent={attPct} label={`${attPct}%`} sub="attendance" tone={attPct >= 75 ? "good" : attPct >= 60 ? "warn" : "bad"} />}
        </div>
      </section>

      {!ready ? <MemberOverviewSkeleton /> : (
      <div className="ov-in">
      <div className="kpi-grid">
        <StatCard loading={attQ.status === "loading"} error={attQ.status === "error"} icon="checkCircle" label="Attendance" suffix="%" value={attPct} note={attNote} tone={attPct >= 75 ? "good" : "warn"} to={dashPath("attendance")} />
        <StatCard loading={hwQ.status === "loading"} error={hwQ.status === "error"} icon="clipboard" label="Homework to do" value={pending.length} note="Due soon" tone={pending.length ? "warn" : "good"} to={dashPath("homework")} />
        <StatCard loading={examsQ.status === "loading"} error={examsQ.status === "error"} icon="calendar" label="Upcoming exams" value={exams?.length ?? 0} note={nextExam ? `Next: ${nextExam.subject_name}` : "None scheduled"} to={dashPath("exams")} />
        <StatCard loading={resultsQ.status === "loading"} error={resultsQ.status === "error"} icon="award" label="Average" suffix="%" value={avg} note={`${bySubject.length} subjects`} tone="good" to={dashPath("results")} />
      </div>

      <div className="grid-3">
        <section className="panel">
          <div className="panel-title"><h2><Icon name="clock" size={18} /> Today's timetable</h2><Link className="panel-link" to={dashPath("timetable")}>Week <Icon name="arrowRight" size={14} /></Link></div>
          {ttQ.status === "error" ? <RetryState onRetry={ttQ.reload} /> : tt === null ? <Skeleton rows={4} /> : today.length === 0 ? <EmptyState icon="clock" title="No periods today" text={tt.length === 0 ? "Your class timetable has not been published yet." : "Enjoy your day off."} /> : <TodayList rows={today} />}
        </section>
        <section className="panel">
          <div className="panel-title"><h2><Icon name="clipboard" size={18} /> Homework</h2><Link className="panel-link" to={dashPath("homework")}>All <Icon name="arrowRight" size={14} /></Link></div>
          {hwQ.status === "error" ? <RetryState onRetry={hwQ.reload} /> : hw === null ? <Skeleton rows={3} /> : hwList.length === 0 ? <EmptyState icon="checkCircle" title="All caught up" text="No homework due." /> : (
            <div className="list">
              {hwList.slice(0, 4).map((h) => (
                <div className="row-link" key={h.id}>
                  <button type="button" className="icon-btn" onClick={() => tick(h)} aria-pressed={!!h.done} aria-label={h.done ? "Mark as not done" : "Mark as done"} style={{ borderRadius: "50%", color: h.done ? "#fff" : "var(--fg-faint)", background: h.done ? "var(--good)" : undefined }}><Icon name="check" size={17} /></button>
                  <span className="row-main"><strong style={{ textDecoration: h.done ? "line-through" : "none" }}>{h.title}</strong><span>{h.subject_name} · due {new Date(h.due_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <section className="panel">
          <div className="panel-title"><h2><Icon name="calendar" size={18} /> My attendance</h2></div>
          {attQ.status === "error" ? <RetryState onRetry={attQ.reload} /> : att === null ? <Skeleton rows={3} /> : att.length === 0 ? <EmptyState icon="clock" title="No attendance yet" text="It appears once your teacher records it." /> : <MonthCalendar records={att} />}
        </section>
        <section className="panel">
          <div className="panel-title"><h2><Icon name="award" size={18} /> Subject performance</h2><Link className="panel-link" to={dashPath("results")}>Details <Icon name="arrowRight" size={14} /></Link></div>
          {resultsQ.status === "error" ? <RetryState onRetry={resultsQ.reload} /> : results === null ? <Skeleton rows={4} /> : bySubject.length === 0 ? <EmptyState icon="award" title="No marks yet" text="Subject results appear after your teachers enter marks." /> : (
            <div className="list">
              {bySubject.map((s) => (
                <div key={s.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}><span style={{ color: "var(--fg)", fontWeight: 600 }}>{s.name}</span><b>{s.pct}%</b></div>
                  <div className={`pct-bar tone-${tone(s.pct)}`}><i style={{ width: `${s.pct}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-title"><h2><Icon name="megaphone" size={18} /> Notices</h2><Link className="panel-link" to={dashPath("notices")}>All <Icon name="arrowRight" size={14} /></Link></div>
        <NoticeList notices={notices} failed={noticesQ.status === "error"} onRetry={noticesQ.reload} />
      </section>
      </div>
      )}
    </>
  );
}
