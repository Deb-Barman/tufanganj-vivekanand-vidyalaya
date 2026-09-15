import "./Faculty.css";

export function Faculty() {
  return (
    <section className="section" id="teachers">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">
            <span className="num">03</span>Our Faculty
          </div>
          <h2>Thirty teachers. One staff room, many specialities.</h2>
          <p className="lede">Every subject on our timetable is taught by someone who studied it.</p>
        </div>
        <div className="todo-panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
            <path d="M12 9v4M12 16.5h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <div>
            <strong>TODO / Required Data — Faculty directory</strong>
            <p>
              Real teacher names, subjects, departments and bios have not been provided yet. Once the school shares
              verified staff information, this section will list each teacher via the Super Admin dashboard's
              Faculty module (backed by <code>TeacherProfile</code> in the backend) rather than static content here.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
