import { useMemo, useState } from "react";
import type { PortfolioClass, PortfolioSemester } from "../../types/api";
import "./portfolio.css";

/**
 * Results as a portfolio: Class → every semester → every subject, in ONE compact table per class
 * (rows = subjects, columns = semesters) instead of a tall card per exam. Used on the student's own "My results"
 * page and on the public profile (where `summary` data has no subjects, so it shows one slim row per semester).
 */
const tone = (p: number) => (p >= 60 ? "good" : p >= 40 ? "warn" : "bad");

function Pct({ p, strong }: { p: number; strong?: boolean }) {
  return <span className={`rx-pct tone-${tone(p)}${strong ? " strong" : ""}`}>{p}%</span>;
}

function Bar({ p }: { p: number }) {
  return <span className={`rx-bar tone-${tone(p)}`} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, p))}%` }} /></span>;
}

/** Rows = subjects (union across the class's semesters), columns = semesters. */
function Matrix({ sems }: { sems: PortfolioSemester[] }) {
  const subjects = useMemo(() => {
    const names = new Map<string, string>();
    sems.forEach((s) => s.subjects?.forEach((x) => names.set(x.name.toLowerCase(), x.name)));
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sems]);
  return (
    <div className="rx-scroll" tabIndex={0} role="region" aria-label="Marks by subject and semester">
      <table className="rx-table">
        <thead>
          <tr>
            <th scope="col">Subject</th>
            {sems.map((s) => <th scope="col" key={s.term}>{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {subjects.map(([key, name]) => (
            <tr key={key}>
              <th scope="row">{name}</th>
              {sems.map((s) => {
                const m = s.subjects?.find((x) => x.name.toLowerCase() === key);
                return (
                  <td key={s.term}>
                    {m ? (
                      <span className="rx-cell">
                        <b>{m.got}<small>/{m.full}</small></b>
                        <Bar p={m.percent} />
                      </span>
                    ) : <span className="rx-none">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Overall</th>
            {sems.map((s) => (
              <td key={s.term}><span className="rx-cell"><Pct p={s.percent} strong />{s.got !== undefined && <small className="rx-total">{s.got}/{s.full}</small>}</span></td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Summary mode: no subject names or marks, only each semester's percentage. */
function SummaryRows({ sems }: { sems: PortfolioSemester[] }) {
  return (
    <ul className="rx-summary">
      {sems.map((s) => (
        <li key={s.term}>
          <span className="rx-sem">{s.label}<small>{s.subject_count} {s.subject_count === 1 ? "subject" : "subjects"}</small></span>
          <Bar p={s.percent} />
          <Pct p={s.percent} strong />
        </li>
      ))}
    </ul>
  );
}

export function ResultsExplorer({ classes, overall, topSubjects }: { classes: PortfolioClass[]; overall: number; topSubjects?: { name: string; percent: number }[] }) {
  const [pick, setPick] = useState<string | null>(null);
  if (classes.length === 0) return <p className="rx-empty">No marks have been entered yet.</p>;
  const key = (c: PortfolioClass) => `${c.class_label}|${c.session}`;
  const active = classes.find((c) => key(c) === pick) ?? classes[classes.length - 1]; // newest class first
  const hasSubjects = active.semesters.some((s) => s.subjects);
  return (
    <div className="rx">
      <div className="rx-top">
        <div className="rx-overall">
          <span className={`rx-ring tone-${tone(overall)}`} style={{ ["--p" as string]: overall }}><b>{overall}%</b></span>
          <span className="rx-overall-text"><b>Overall</b><small>{classes.length} {classes.length === 1 ? "class" : "classes"} · {classes.reduce((n, c) => n + c.semesters.length, 0)} semesters</small></span>
        </div>
        {topSubjects && topSubjects.length > 0 && (
          <ul className="rx-top-subjects" aria-label="Strongest subjects">
            {topSubjects.map((t) => <li key={t.name}><span>{t.name}</span><Pct p={t.percent} /></li>)}
          </ul>
        )}
      </div>

      <div className="rx-tabs" role="tablist" aria-label="Class">
        {classes.map((c) => (
          <button type="button" role="tab" key={key(c)} aria-selected={c === active} className={c === active ? "on" : ""} onClick={() => setPick(key(c))}>
            {c.class_label}<small>{c.session}</small>
            <Pct p={c.percent} />
          </button>
        ))}
      </div>

      <div className="rx-panel" role="tabpanel">
        {hasSubjects ? <Matrix sems={active.semesters} /> : <SummaryRows sems={active.semesters} />}
      </div>
    </div>
  );
}
