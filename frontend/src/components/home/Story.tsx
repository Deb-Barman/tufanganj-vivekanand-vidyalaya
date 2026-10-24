import { useState } from "react";
import { SchoolLogo } from "../SchoolLogo";
import { useScrollProgress } from "./scroll";

const CHAPTERS = [
  { big: "1964", tag: "Chapter one", title: "It began in Tufanganj.", text: "Tufanganj Vivekananda Vidyalaya (H.S.) opened its doors in 1964 and has taught this town's children ever since — named after Swami Vivekananda, whose call to “arise, awake” is the spirit the school carries." },
  { big: "V–XII", tag: "Chapter two", title: "Eight classes, one campus.", text: "A child can walk in at Class V and walk out at Class XII without changing schools — learning on the same grounds, year after year." },
  { big: "02", tag: "Chapter three", title: "Science and Arts.", text: "At the Higher Secondary level students choose between the Science and Arts streams in Class XI–XII, both under the West Bengal board." },
  { big: "Now", tag: "Chapter four", title: "A school that is also digital.", text: "Notices, timetables, homework, results and attendance live in one student and staff portal — and every student can build a public portfolio page from it." },
];

/**
 * Scroll-told story. The section is 4 screens tall; the stage inside stays pinned while the chapters change as you
 * scroll. (With reduced motion the chapters simply stack as normal text — see home.css.)
 */
export function Story() {
  const [active, setActive] = useState(0);
  const ref = useScrollProgress<HTMLElement>("track", (p) => {
    const i = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));
    setActive((cur) => (cur === i ? cur : i));
  });
  return (
    <section className="story" ref={ref} aria-label="The story of the school">
      <div className="story-stage">
        <div className="story-bg" aria-hidden="true"><i /><i /></div>
        <div className="wrap story-grid">
          <div className="story-visual" aria-hidden="true">
            <svg className="story-ring" viewBox="0 0 200 200">
              <circle className="trk" cx="100" cy="100" r="92" />
              <circle className="prg" cx="100" cy="100" r="92" />
            </svg>
            <div className="story-orbit"><i /><i /><i /></div>
            <div className="story-core"><SchoolLogo size={110} /></div>
            <div className="story-big">
              {CHAPTERS.map((c, i) => <span key={c.big} className={i === active ? "on" : i < active ? "past" : ""}>{c.big}</span>)}
            </div>
          </div>
          <div className="story-text">
            <ol className="story-dots" aria-hidden="true">{CHAPTERS.map((c, i) => <li key={c.big} className={i === active ? "on" : i < active ? "done" : ""} />)}</ol>
            <div className="story-chapters">
              {CHAPTERS.map((c, i) => (
                <article key={c.big} className={`story-ch${i === active ? " on" : i < active ? " past" : ""}`} aria-current={i === active}>
                  <span className="eyebrow">{c.tag}</span>
                  <h2>{c.title}</h2>
                  <p>{c.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
        <div className="story-hint" aria-hidden="true"><i /> Keep scrolling</div>
      </div>
    </section>
  );
}
