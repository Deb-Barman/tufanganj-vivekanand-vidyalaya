import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import type { AcademicSession, AttendanceReport, AttendanceReportRow, AttendanceStatus, SchoolClass } from "../../types/api";
import { EmptyState, Icon, PageHeader, Segmented, Skeleton, StatusPill, errText, listAll, useDebounced, useUI, Select, classLabel } from "../ui/kitExports";
import "./attendance-report.css";

const TONE: Record<AttendanceStatus, "good" | "warn" | "bad" | "muted"> = { ok: "good", low: "warn", critical: "bad", no_data: "muted" };
const WORD: Record<AttendanceStatus, string> = { ok: "On track", low: "Needs attention", critical: "Cannot reach minimum", no_data: "No records yet" };
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/** Super Admin: attendance % for every student / teacher against the session's total working days. */
export function AttendanceReportModule() {
  const { toast } = useUI();
  const [kind, setKind] = useState<"students" | "teachers">("students");
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [session, setSession] = useState("");
  const [klass, setKlass] = useState("");
  const [only, setOnly] = useState<"all" | "attention">("all");
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [data, setData] = useState<AttendanceReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([listAll<AcademicSession>("/academics/sessions/"), listAll<SchoolClass>("/academics/classes/")])
      .then(([s, c]) => {
        setSessions(s);
        setClasses(c);
        setSession(s.find((x) => x.is_current)?.id ?? "");
      })
      .catch((e) => toast("error", errText(e, "Could not load sessions.")));
  }, [toast]);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ kind });
    if (session) qs.set("session", session);
    if (kind === "students" && klass) qs.set("school_class", klass);
    // oxlint-disable-next-line react/set-state-in-effect
    setData(null);
    setFailed(false);
    api.get<AttendanceReport>(`/academics/attendance-report/?${qs}`).then((d) => alive && setData(d), (e) => { if (alive) { setFailed(true); toast("error", errText(e, "Could not load the report.")); } });
    return () => {
      alive = false;
    };
  }, [kind, session, klass, toast]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => (only === "all" || r.status === "low" || r.status === "critical") && (!s || `${r.name} ${r.username} ${r.group} ${r.roll_number}`.toLowerCase().includes(s)));
  }, [data, only, q]);

  function exportCsv() {
    if (!data) return;
    const esc = (v: string | number | null) => `"${String(v ?? "").replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;
    const head = ["Name", "Username", kind === "students" ? "Class" : "Department", "Present", "Absent", "Days marked", "% of days held", "% of total working days", "Best possible %", "Status"];
    const lines = [head.map(esc).join(","), ...rows.map((r) => [r.name, r.username, r.group, r.present, r.absent, r.marked, r.percent, r.percent_of_total, r.best_possible_percent, WORD[r.status]].map(esc).join(","))];
    const url = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `attendance-${kind}-${data.session?.label ?? "report"}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const s = data?.summary;
  const min = data?.session?.min_percent ?? 75;
  return (
    <>
      <PageHeader icon="trend" title="Attendance report" sub="Who needs attention? Each person's attendance as a percentage of the days held so far and of the session's total working days." actions={<button type="button" className="btn btn-outline btn-sm" disabled={!data || rows.length === 0} onClick={exportCsv}><Icon name="download" size={16} /> Download CSV</button>} />
      <div className="toolbar">
        <Segmented value={kind} onChange={(v) => { setKind(v); setKlass(""); }} options={[{ value: "students", label: "Students" }, { value: "teachers", label: "Teachers" }]} />
        <div className="form-field">
          <label htmlFor="arSession">Session</label>
          <Select id="arSession" value={session} onChange={(e) => setSession(e.target.value)}>
            <option value="">All time</option>
            {sessions.map((x) => <option key={x.id} value={x.id}>{x.label}{x.is_current ? " (current)" : ""}</option>)}
          </Select>
        </div>
        {kind === "students" && (
          <div className="form-field">
            <label htmlFor="arClass">Class</label>
            <Select id="arClass" value={klass} onChange={(e) => setKlass(e.target.value)}>
              <option value="">All classes</option>
              {classes.filter((c) => !session || c.session === session).map((c) => <option key={c.id} value={c.id}>{classLabel(c, sessions)}</option>)}
            </Select>
          </div>
        )}
        <div className="search-box grow"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or username" aria-label="Search" /></div>
      </div>

      {failed ? (
        <EmptyState icon="alert" title="The report could not be loaded" text="Check your connection and open this page again." />
      ) : !data || !s ? (
        <Skeleton rows={5} />
      ) : (
        <>
          {data.session && !data.session.working_days && (
            <p className="ar-hint"><Icon name="alert" size={16} /> Set the <b>total working days</b> (for example 200) for session {data.session.label} under <b>Classes &amp; Subjects</b> to see the “% of the whole session” and “can still reach” figures. Until then, percentages use only the days held so far.</p>
          )}
          <div className="ar-kpis">
            <div><b>{s.working_days ?? "—"}</b><span>total working days</span></div>
            <div><b>{s.days_held}</b><span>days held so far{s.percent_of_session_done !== null ? ` (${s.percent_of_session_done}%)` : ""}</span></div>
            <div><b>{s.days_left ?? "—"}</b><span>days left</span></div>
            <div><b>{pct(s.average_percent)}</b><span>average attendance</span></div>
            <div className={s.low + s.critical ? "bad" : "ok"}><b>{s.low + s.critical}</b><span>need attention (below {min}%)</span></div>
          </div>
          <div className="toolbar">
            <Segmented value={only} onChange={setOnly} options={[{ value: "all", label: `Everyone (${s.people})` }, { value: "attention", label: `Needs attention (${s.low + s.critical})` }]} />
          </div>
          {rows.length === 0 ? (
            <EmptyState icon="checkCircle" title={only === "attention" ? "Nobody needs attention" : "Nothing to show"} text={only === "attention" ? `Everyone with records is at or above ${min}%.` : "No active people match this view."} />
          ) : (
            <div className="list ar-list">
              {rows.map((r) => <ReportRow key={r.id} r={r} min={min} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}

function ReportRow({ r, min }: { r: AttendanceReportRow; min: number }) {
  const tone = TONE[r.status];
  return (
    <div className="row-link ar-row">
      <span className="row-main">
        <strong>{r.name}</strong>
        <span>{r.group}{r.roll_number ? ` · Roll ${r.roll_number}` : ""} · @{r.username}</span>
      </span>
      <span className="ar-nums">
        <span title="Days present / days marked"><b>{r.present}</b>/{r.marked} days</span>
        {r.percent_of_total !== null && <span title="Present days ÷ total working days of the session">{r.percent_of_total}% of session</span>}
        {r.days_left !== null && r.best_possible_percent !== null && r.status !== "no_data" && <span title={`If present on all ${r.days_left} remaining days`}>best possible {r.best_possible_percent}%</span>}
      </span>
      <span className={`ar-bar tone-${tone}`} role="img" aria-label={`Attendance ${pct(r.percent)}`}>
        <span className="pct-bar"><i style={{ width: `${r.percent ?? 0}%` }} /><em style={{ left: `${min}%` }} /></span>
        <b>{pct(r.percent)}</b>
      </span>
      <StatusPill tone={tone}>{WORD[r.status]}</StatusPill>
    </div>
  );
}
