import "./Faculty.css"; // shared .todo-panel styles

export function Achievements() {
  return (
    <section className="section" id="achievements">
      <div className="wrap">
        <div className="section-head" data-reveal>
          <div className="eyebrow">
            <span className="num">04</span>Outcomes, Not Claims
          </div>
          <h2>What our students actually go on to do.</h2>
          <p className="lede">Results are the real test of any school.</p>
        </div>
        <div className="todo-panel" data-reveal>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
            <path d="M12 9v4M12 16.5h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <div>
            <strong>TODO / Required Data — Results &amp; achievements</strong>
            <p>
              The original concept used placeholder figures (pass rate, sports trophies, top scorers) explicitly
              marked as demo content. Real board results and achievement records will be pulled from the backend's
              <code> Result</code> and event records once the school confirms current-session figures — nothing is
              invented here in the meantime.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
