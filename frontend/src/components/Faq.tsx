import { useState } from "react";
import faqs from "../seo/faqs.json";
import "./Faq.css";

const FAQS: { q: string; a: string }[] = faqs;

export function Faq({ bare = false }: { bare?: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className={bare ? "section bare" : "section"} id="faq">
      <div className="wrap">
        {!bare && (
<div className="section-head" data-reveal>
          <div className="eyebrow">
            <span className="num">07</span>Questions Parents Ask
          </div>
          <h2>Answered before you have to call.</h2>
        </div>
        )}
        <div className="faq-list">
          {FAQS.map((item, i) => (
            <div className={`faq-item${openIndex === i ? " is-open" : ""}`} key={item.q} data-reveal style={{ ["--d" as string]: i % 3 }}>
              <button
                type="button"
                className="faq-q"
                id={`faq-q-${i}`}
                aria-expanded={openIndex === i}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span>{item.q}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={openIndex === i ? "rot" : ""}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div className={`faq-a-wrap${openIndex === i ? " open" : ""}`} id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>
                <div className="faq-a">
                  <p>{item.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
