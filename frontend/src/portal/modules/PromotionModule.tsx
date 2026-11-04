import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { EmptyState, Icon, PageHeader, Segmented, Skeleton, StatusPill, errText, useUI, Select } from "../ui/kitExports";
import "./promotion.css";

/* ───────────── types (what /academics/promotion/* sends) ───────────── */
interface PlanStudent { id: string; name: string; username: string; roll: string }
interface PlanClass { id: string; label: string; name: string; stream: string; target: { name: string; stream: string; passes_out: boolean; needs_stream: boolean; known: boolean }; students: PlanStudent[] }
interface Plan { from_session: { id: string; label: string }; suggested_label: string; streams: string[]; classes: PlanClass[] }
interface Batch { id: string; created_at: string; from_session: string; to_session: string; promoted: number; repeated: number; passed_out: number; created_classes: number; undone: boolean; can_undo: boolean; by: string }
type Choice = "promote" | "repeat" | "passed_out";

/**
 * Year-end promotion for the Super Admin, in three steps: new session → tick who goes up → review & confirm.
 * Only the students you leave on "Goes up" move to the next class; the others repeat their class in the new session.
 * Nothing old is deleted — results, attendance and homework stay with each student, and a run can be undone.
 */
export function PromotionModule() {
  const { toast, confirm } = useUI();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [label, setLabel] = useState("");
  const [makeCurrent, setMakeCurrent] = useState(true);
  const [copySubjects, setCopySubjects] = useState(true);
  const [copyTimetable, setCopyTimetable] = useState(true);
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const [stream, setStream] = useState<Record<string, string>>({});
  const [targetName, setTargetName] = useState<Record<string, string>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Batch | null>(null);

  const loadBatches = useCallback(() => api.get<Batch[]>("/academics/promotion/batches/").then(setBatches).catch(() => setBatches([])), []);
  const loadPlan = useCallback(async () => {
    setError(null);
    try {
      const p = await api.get<Plan>("/academics/promotion/plan/");
      setPlan(p);
      setLabel((cur) => cur || p.suggested_label);
      const c: Record<string, Choice> = {};
      p.classes.forEach((k) => k.students.forEach((s) => (c[s.id] = k.target.passes_out ? "passed_out" : "promote")));
      setChoice(c);
      setOpen(p.classes[0]?.id ?? null);
    } catch (e) {
      setError(errText(e, "Could not load the classes."));
      setPlan({ from_session: { id: "", label: "" }, suggested_label: "", streams: [], classes: [] });
    }
  }, []);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    loadPlan();
    loadBatches();
  }, [loadPlan, loadBatches]);

  const classes = useMemo(() => (plan?.classes ?? []).filter((c) => c.students.length > 0), [plan]);

  /* counts per class + overall, and what still blocks the run */
  const stats = useMemo(() => {
    const rows = classes.map((c) => {
      const included = !skip[c.id];
      let up = 0, stay = 0, out = 0, noStream = 0;
      if (included) {
        c.students.forEach((s) => {
          const ch = choice[s.id];
          if (ch === "repeat") stay++;
          else if (ch === "passed_out") out++;
          else {
            up++;
            if (c.target.needs_stream && !targetName[c.id]?.trim() && !stream[s.id]) noStream++;
          }
        });
      }
      const unknown = included && up > 0 && !c.target.known && !targetName[c.id]?.trim();
      return { c, included, up, stay, out, noStream, unknown };
    });
    const sum = (k: "up" | "stay" | "out") => rows.reduce((n, r) => n + r[k], 0);
    return { rows, up: sum("up"), stay: sum("stay"), out: sum("out"), problems: rows.reduce((n, r) => n + r.noStream + (r.unknown ? 1 : 0), 0) };
  }, [classes, choice, stream, targetName, skip]);

  const setAll = (c: PlanClass, v: Choice) => setChoice((p) => ({ ...p, ...Object.fromEntries(c.students.map((s) => [s.id, v])) }));

  async function run() {
    if (!plan) return;
    const ok = await confirm({
      title: `Move students to ${label.trim()}?`,
      message: `${stats.up} go up, ${stats.stay} stay in their class, ${stats.out} pass out. Their old results, attendance and homework stay in their accounts. You can undo this afterwards.`,
      confirmLabel: "Yes, promote",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const body = {
        to_session_label: label.trim(),
        make_current: makeCurrent,
        copy_subjects: copySubjects,
        copy_timetable: copyTimetable,
        classes: stats.rows.filter((r) => r.included).map((r) => ({
          class_id: r.c.id,
          ...(targetName[r.c.id]?.trim() ? { target_name: targetName[r.c.id].trim() } : {}),
          students: r.c.students.map((s) => ({ student_id: s.id, action: choice[s.id] ?? "promote", ...(stream[s.id] ? { stream: stream[s.id] } : {}) })),
        })),
      };
      const b = await api.post<Batch>("/academics/promotion/apply/", body);
      setDone(b);
      toast("success", `Done: ${b.promoted} promoted, ${b.repeated} stayed, ${b.passed_out} passed out.`);
      loadBatches();
    } catch (e) {
      toast("error", errText(e, "Could not promote the students. Nothing was changed."));
    } finally {
      setBusy(false);
    }
  }

  async function undo(b: Batch) {
    const ok = await confirm({ title: "Undo this promotion?", message: `All students go back to their class in ${b.from_session}. Anything new made for ${b.to_session} and not used yet is removed.`, confirmLabel: "Undo", danger: true });
    if (!ok) return;
    try {
      await api.post(`/academics/promotion/batches/${b.id}/undo/`, {});
      toast("success", "Promotion undone.");
      setDone(null);
      setStep(1);
      await Promise.all([loadBatches(), loadPlan()]);
    } catch (e) {
      toast("error", errText(e, "Could not undo."));
    }
  }

  /* ───── finished ───── */
  if (done) {
    return (
      <>
        <PageHeader icon="trend" title="Promote students" sub="Year-end class change." />
        <section className="panel pm-done">
          <span className="pm-done-ico"><Icon name="checkCircle" size={34} /></span>
          <h2>{done.to_session} has started</h2>
          <div className="pm-numbers">
            <div><b>{done.promoted}</b><span>went up</span></div>
            <div><b>{done.repeated}</b><span>stayed in class</span></div>
            <div><b>{done.passed_out}</b><span>passed out</span></div>
            <div><b>{done.created_classes}</b><span>new classes made</span></div>
          </div>
          <p>Every student's old results, attendance, homework and timetable are still in their account. Next: check <b>Classes &amp; Subjects</b> for the new classes (subjects were copied) and re-check roll numbers on the <b>Students</b> page.</p>
          <div className="pm-actions">
            <button type="button" className="btn btn-primary" onClick={() => { setDone(null); setStep(1); loadPlan(); }}>Back to start</button>
            <button type="button" className="btn btn-outline" onClick={() => undo({ ...done, can_undo: true })}>Undo this promotion</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader icon="trend" title="Promote students" sub="Move this year's students to the next class in a few steps. Only the students you choose go up; the rest stay in their class." />

      <ol className="pm-steps" aria-label="Steps">
        {["New year", "Choose students", "Review"].map((t, i) => (
          <li key={t} className={step === i + 1 ? "on" : step > i + 1 ? "done" : ""}><span>{step > i + 1 ? <Icon name="check" size={14} /> : i + 1}</span>{t}</li>
        ))}
      </ol>

      {error && <p className="alert alert-error">{error}</p>}
      {plan === null ? <Skeleton rows={4} /> : classes.length === 0 ? (
        <EmptyState icon="cap" title="No students to promote" text={`There are no students in a class of ${plan.from_session.label || "the current session"} yet.`} />
      ) : (
        <>
          {/* ───── step 1 ───── */}
          {step === 1 && (
            <section className="panel pm-card">
              <div className="panel-title"><h3>1 · The new school year</h3></div>
              <p className="pf-note">You are closing <b>{plan.from_session.label}</b>. Write the session that starts now.</p>
              <div className="form-field" style={{ maxWidth: 320 }}>
                <label htmlFor="pmLabel">New session</label>
                <input id="pmLabel" value={label} maxLength={20} onChange={(e) => setLabel(e.target.value)} placeholder="2027-2028" />
              </div>
              <div className="pm-checks">
                <label><input type="checkbox" checked={makeCurrent} onChange={(e) => setMakeCurrent(e.target.checked)} /><span><b>Make it the current session</b><small>New attendance and results go into it.</small></span></label>
                <label><input type="checkbox" checked={copySubjects} onChange={(e) => { setCopySubjects(e.target.checked); if (!e.target.checked) setCopyTimetable(false); }} /><span><b>Copy subjects and their teachers</b><small>Each new class starts with last year's subjects.</small></span></label>
                <label className={copySubjects ? "" : "off"}><input type="checkbox" checked={copyTimetable && copySubjects} disabled={!copySubjects} onChange={(e) => setCopyTimetable(e.target.checked)} /><span><b>Copy the weekly timetable</b><small>You can edit it later on the Timetable page.</small></span></label>
              </div>
              <p className="pf-note pm-keep"><Icon name="shield" size={14} /> Nothing is deleted. Old results, attendance, homework and timetables stay in each student's account and in the old session.</p>
              <div className="pm-actions"><button type="button" className="btn btn-primary" disabled={!label.trim()} onClick={() => setStep(2)}>Next: choose students →</button></div>
            </section>
          )}

          {/* ───── step 2 ───── */}
          {step === 2 && (
            <>
              <section className="panel pm-card">
                <div className="panel-title"><h3>2 · Who goes up?</h3></div>
                <p className="pf-note">Everyone starts on <b>Goes up</b>. Change a student to <b>Stays</b> if they did not pass — they repeat the same class in {label || "the new session"}.</p>
                <div className="pm-totals"><StatusPill tone="good">{stats.up} go up</StatusPill><StatusPill tone="warn">{stats.stay} stay</StatusPill>{stats.out > 0 && <StatusPill tone="info">{stats.out} pass out</StatusPill>}</div>
              </section>
              <div className="pm-classes">
                {stats.rows.map(({ c, included, up, stay, out, noStream, unknown }) => {
                  const isOpen = open === c.id;
                  const goLabel = c.target.passes_out ? "Passes out" : "Goes up";
                  const goValue: Choice = c.target.passes_out ? "passed_out" : "promote";
                  return (
                    <section key={c.id} className={`panel pm-class${included ? "" : " skipped"}`}>
                      <button type="button" className="pm-class-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)}>
                        <span className="pm-class-name">
                          <b>{c.label}</b>
                          <span className="pm-arrow">{c.target.passes_out ? "→ Passed out (alumni)" : `→ ${targetName[c.id]?.trim() || c.target.name || "?"}${c.target.needs_stream ? " (Science / Arts)" : c.target.stream ? ` ${c.target.stream}` : ""}`}</span>
                        </span>
                        <span className="pm-class-count">
                          {included ? <><StatusPill tone="good">{c.target.passes_out ? out : up} {c.target.passes_out ? "pass out" : "up"}</StatusPill>{stay > 0 && <StatusPill tone="warn">{stay} stay</StatusPill>}</> : <StatusPill tone="muted">Not included</StatusPill>}
                          {(noStream > 0 || unknown) && <StatusPill tone="bad">needs attention</StatusPill>}
                        </span>
                        <Icon name="chevronDown" size={18} />
                      </button>
                      {isOpen && (
                        <div className="pm-class-body">
                          <div className="pm-class-tools">
                            <label className="pm-include"><input type="checkbox" checked={included} onChange={(e) => setSkip((p) => ({ ...p, [c.id]: !e.target.checked }))} /> Include this class</label>
                            {included && (
                              <>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => setAll(c, goValue)}>Everyone {c.target.passes_out ? "passes out" : "goes up"}</button>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => setAll(c, "repeat")}>Everyone stays</button>
                                {c.target.needs_stream && (
                                  <Select aria-label="Set the stream for everyone going up" value="" onChange={(e) => e.target.value && setStream((p) => ({ ...p, ...Object.fromEntries(c.students.filter((s) => choice[s.id] !== "repeat").map((s) => [s.id, e.target.value])) }))} style={{ minWidth: 200 }}>
                                    <option value="">Set stream for all…</option>
                                    {plan.streams.map((s) => <option key={s} value={s}>{s}</option>)}
                                  </Select>
                                )}
                              </>
                            )}
                          </div>
                          {included && !c.target.known && !c.target.passes_out && (
                            <div className="form-field" style={{ maxWidth: 340 }}>
                              <label htmlFor={`pmT${c.id}`}>I do not know the class after “{c.name}”. Write its name:</label>
                              <input id={`pmT${c.id}`} value={targetName[c.id] ?? ""} placeholder="e.g. Class 1" maxLength={50} onChange={(e) => setTargetName((p) => ({ ...p, [c.id]: e.target.value }))} />
                            </div>
                          )}
                          <ul className={`pm-students${included ? "" : " off"}`}>
                            {c.students.map((s) => {
                              const ch = choice[s.id] ?? goValue;
                              return (
                                <li key={s.id} className={ch === "repeat" ? "stay" : ""}>
                                  <span className="pm-roll">{s.roll || "–"}</span>
                                  <span className="pm-sname"><b>{s.name}</b><small>@{s.username}</small></span>
                                  {c.target.needs_stream && ch === "promote" && !targetName[c.id]?.trim() && (
                                    <Select aria-label={`Stream for ${s.name}`} value={stream[s.id] ?? ""} onChange={(e) => setStream((p) => ({ ...p, [s.id]: e.target.value }))} style={{ minWidth: 150 }}>
                                      <option value="">Stream…</option>
                                      {plan.streams.map((st) => <option key={st} value={st}>{st}</option>)}
                                    </Select>
                                  )}
                                  <Segmented<Choice> value={ch === "repeat" ? "repeat" : goValue} onChange={(v) => setChoice((p) => ({ ...p, [s.id]: v }))} options={[{ value: goValue, label: goLabel }, { value: "repeat", label: "Stays" }]} />
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
              <div className="pm-actions sticky">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button type="button" className="btn btn-primary" disabled={stats.up + stats.stay + stats.out === 0 || stats.problems > 0} onClick={() => setStep(3)}>{stats.problems > 0 ? `Fix ${stats.problems} thing${stats.problems > 1 ? "s" : ""} first` : "Next: review →"}</button>
              </div>
            </>
          )}

          {/* ───── step 3 ───── */}
          {step === 3 && (
            <section className="panel pm-card">
              <div className="panel-title"><h3>3 · Review</h3></div>
              <div className="pm-numbers">
                <div><b>{stats.up}</b><span>go up</span></div>
                <div><b>{stats.stay}</b><span>stay in class</span></div>
                <div><b>{stats.out}</b><span>pass out</span></div>
              </div>
              <div className="pm-review-wrap">
                <table className="pm-review">
                  <thead><tr><th>From ({plan.from_session.label})</th><th>To ({label})</th><th>Go up</th><th>Stay</th></tr></thead>
                  <tbody>
                    {stats.rows.filter((r) => r.included).map((r) => (
                      <tr key={r.c.id}>
                        <td><b>{r.c.label}</b></td>
                        <td>{r.c.target.passes_out ? "Passed out" : `${targetName[r.c.id]?.trim() || r.c.target.name}${r.c.target.needs_stream ? " (stream chosen per student)" : r.c.target.stream ? " " + r.c.target.stream : ""}`}</td>
                        <td>{r.c.target.passes_out ? `${r.out} pass out` : r.up}</td>
                        <td>{r.stay}{r.stay > 0 ? ` (repeat ${r.c.name})` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="pm-facts">
                <li><Icon name="check" size={15} /> Session <b>{label}</b> {makeCurrent ? "becomes the current session" : "is created (not made current)"}.</li>
                <li><Icon name="check" size={15} /> New classes are created as needed{copySubjects ? ", with last year's subjects and teachers" : ""}{copySubjects && copyTimetable ? " and the weekly timetable" : ""}.</li>
                <li><Icon name="check" size={15} /> Old results, attendance, marksheets, homework and timetables are kept.</li>
                <li><Icon name="check" size={15} /> You can undo this run from the history below.</li>
              </ul>
              <div className="pm-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(2)} disabled={busy}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>{busy ? "Working…" : `Promote ${stats.up + stats.stay + stats.out} students`}</button>
              </div>
            </section>
          )}
        </>
      )}

      {batches.length > 0 && (
        <section className="panel pm-history">
          <div className="panel-title"><h3>Earlier promotions</h3></div>
          <ul>
            {batches.map((b) => (
              <li key={b.id} className={b.undone ? "undone" : ""}>
                <span><b>{b.from_session || "?"} → {b.to_session}</b><small>{new Date(b.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{b.by ? ` · ${b.by}` : ""}</small></span>
                <span className="pm-hist-n">{b.promoted} up · {b.repeated} stayed · {b.passed_out} passed out</span>
                {b.undone ? <StatusPill tone="muted">Undone</StatusPill> : b.can_undo ? <button type="button" className="btn btn-outline btn-sm" onClick={() => undo(b)}>Undo</button> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
