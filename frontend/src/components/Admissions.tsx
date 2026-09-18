import { useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import "./Admissions.css";

const STEPS = [
  { n: "01", title: "Collect the prospectus", body: "Available from the school office during working hours, with the current fee structure and required documents." },
  { n: "02", title: "Submit the application", body: "Complete the admission form with the student's previous mark-sheet and requested identification documents." },
  { n: "03", title: "Interview & confirmation", body: "A short interaction with the admissions panel, followed by seat confirmation and fee deposit." },
];

export function Admissions() {
  const [applicantName, setApplicantName] = useState("");
  const [guardianContact, setGuardianContact] = useState("");
  const [applyingForClass, setApplyingForClass] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(
        "/content/admissions/submit/",
        { applicant_name: applicantName, guardian_contact: guardianContact, applying_for_class: applyingForClass, message },
        { auth: false }
      );
      setSubmitted(true);
      setApplicantName("");
      setGuardianContact("");
      setApplyingForClass("");
      setMessage("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your enquiry. Please try again or contact the office directly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section" id="admissions">
      <div className="wrap admissions-grid">
        <div>
          <div className="eyebrow">
            <span className="num">08</span>Admissions
          </div>
          <h2 className="admissions-h2">How to join TVV.</h2>
          <p className="lede" style={{ marginTop: 18 }}>
            Admissions run in three straightforward steps. Send an enquiry below, or contact the school office
            directly for live dates and forms.
          </p>

          <form className="admissions-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="admApplicant">Student's name</label>
              <input id="admApplicant" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} required maxLength={150} />
            </div>
            <div className="form-field">
              <label htmlFor="admContact">Guardian contact number</label>
              <input id="admContact" value={guardianContact} onChange={(e) => setGuardianContact(e.target.value)} required maxLength={20} />
            </div>
            <div className="form-field">
              <label htmlFor="admClass">Applying for class</label>
              <input id="admClass" value={applyingForClass} onChange={(e) => setApplyingForClass(e.target.value)} required maxLength={50} placeholder="e.g. Class 9" />
            </div>
            <div className="form-field">
              <label htmlFor="admMessage">Message (optional)</label>
              <textarea id="admMessage" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
            </div>
            {error && <p className="alert alert-error">{error}</p>}
            {submitted && <p className="alert alert-info">Thank you — the school office will get in touch soon.</p>}
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting} style={{ alignSelf: "flex-start" }}>
              {submitting ? "Sending…" : "Send Enquiry"}
            </button>
          </form>
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
