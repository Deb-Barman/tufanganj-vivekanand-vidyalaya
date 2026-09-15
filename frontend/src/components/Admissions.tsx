import "./Admissions.css";

const STEPS = [
  { n: "01", title: "Collect the prospectus", body: "Available from the school office during working hours, with the current fee structure and required documents." },
  { n: "02", title: "Submit the application", body: "Complete the admission form with the student's previous mark-sheet and requested identification documents." },
  { n: "03", title: "Interview & confirmation", body: "A short interaction with the admissions panel, followed by seat confirmation and fee deposit." },
];

export function Admissions() {
  return (
    <section className="section" id="admissions">
      <div className="wrap admissions-grid">
        <div>
          <div className="eyebrow">
            <span className="num">08</span>Admissions
          </div>
          <h2 className="admissions-h2">How to join TVV.</h2>
          <p className="lede" style={{ marginTop: 18 }}>
            Admissions run in three straightforward steps. For live dates and forms, contact the school office
            directly.
          </p>
        </div>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="step-n">{step.n}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
