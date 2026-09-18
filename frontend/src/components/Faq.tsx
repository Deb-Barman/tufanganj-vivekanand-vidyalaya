import { useState } from "react";
import "./Faq.css";

const FAQS = [
  {
    q: "Which board is the school affiliated with?",
    a: "TVV follows the West Bengal Board of Secondary Education up to Class X, and the West Bengal Council of Higher Secondary Education for Class XI–XII, across both Science and Arts streams.",
  },
  {
    q: "What is the admission process and when does it open?",
    a: "Admissions generally open ahead of the new academic session. The process has three steps — collecting the prospectus, submitting the application with prior mark-sheets, and a short admissions interview. Contact the school office for exact current dates.",
  },
  {
    q: "Is transport available for students outside Tufanganj town?",
    a: "Many students commute from surrounding areas independently or via local transport; the school itself does not currently run dedicated buses. Please check with the office for the latest arrangement.",
  },
  {
    q: "Can a student switch between Science and Arts after Class X?",
    a: "Stream choice is made at the start of Class XI based on the student's Class X performance and interest. Switching after that point is discouraged but can be discussed with the class teacher and Principal on a case-by-case basis.",
  },
  {
    q: "How does the school communicate with parents day-to-day?",
    a: "Through the physical Notice Board, scheduled Parent-Teacher Meetings, and the digital Notice Board on this site and in the Smart Portal.",
  },
  {
    q: "What safety measures are in place on campus?",
    a: "The campus gate is supervised during school hours, teachers are present through every break period, and each class has a designated teacher-in-charge as a direct point of contact for parents.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">
            <span className="num">07</span>Questions Parents Ask
          </div>
          <h2>Answered before you have to call.</h2>
        </div>
        <div className="faq-list">
          {FAQS.map((item, i) => (
            <div className="faq-item" key={item.q}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={openIndex === i}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span>{item.q}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={openIndex === i ? "rot" : ""}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {openIndex === i && (
                <div className="faq-a">
                  <p>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
