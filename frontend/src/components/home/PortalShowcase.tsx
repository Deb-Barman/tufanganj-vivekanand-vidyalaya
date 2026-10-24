import { Link } from "react-router-dom";
import { useScrollProgress } from "./scroll";

/** A deterministic little attendance pattern for the illustration (no real student data). */
const CELLS = Array.from({ length: 26 * 7 }, (_, i) => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  const f = v - Math.floor(v);
  return f > 0.9 ? "a" : f > 0.12 ? "p" : "n";
});

const POINTS = ["Results by class, semester and subject", "A GitHub-style attendance calendar", "Homework, timetable, exams and notices", "A shareable portfolio page — each student decides what is public"];

/** Decorative preview of the student portal. Floating cards drift at different speeds while you scroll past. */
export function PortalShowcase() {
  const ref = useScrollProgress<HTMLElement>("view");
  return (
    <section className="ps" ref={ref}>
      <div className="wrap ps-grid">
        <div className="ps-copy" data-reveal="left">
          <div className="eyebrow">The student portal</div>
          <h2>Marks, attendance and a portfolio — <span className="serif-word grad-shimmer">all in one login.</span></h2>
          <ul className="ps-points">{POINTS.map((p) => <li key={p}><i aria-hidden="true">✓</i>{p}</li>)}</ul>
          <div className="ps-cta">
            <Link to="/portal" className="btn btn-primary">Open the portal</Link>
            <Link to="/find-profile" className="btn btn-outline">Find a student profile</Link>
          </div>
        </div>

        <div className="ps-stage" aria-hidden="true">
          <div className="ps-card ps-results">
            <b>Results</b>
            <small>Class → semester → subject</small>
            {[["English", 92], ["Mathematics", 78], ["Science", 85], ["Bangla", 66]].map(([n, v]) => (
              <div className="ps-row" key={n}><span>{n}</span><i><u style={{ ["--w" as string]: `${v}%` }} /></i><em>{v}%</em></div>
            ))}
          </div>
          <div className="ps-card ps-att">
            <b>Attendance</b>
            <small>Last 12 months</small>
            <div className="ps-heat">{CELLS.map((c, i) => <u key={i} className={c} />)}</div>
          </div>
          <div className="ps-card ps-prof">
            <span className="ps-avatar" />
            <div><b>Your portfolio</b><small>Skills · projects · achievements</small></div>
            <div className="ps-chips"><u>Python</u><u>Robotics</u><u>Chess</u></div>
          </div>
        </div>
      </div>
    </section>
  );
}
