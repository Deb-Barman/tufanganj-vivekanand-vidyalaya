import { useRef, useState } from "react";
import { SchoolLogo } from "../SchoolLogo";
import { useScrollProgress } from "./scroll";

const CHAPTERS = [
  { big: "1964", tag: "Chapter one", title: "It began in Tufanganj.", text: "Tufanganj Vivekananda Vidyalaya (H.S.) opened its doors in 1964 and has taught this town's children ever since — named after Swami Vivekananda, whose call to “arise, awake” is the spirit the school carries." },
  { big: "V–XII", tag: "Chapter two", title: "Eight classes, one campus.", text: "A child can walk in at Class V and walk out at Class XII without changing schools — learning on the same grounds, year after year." },
  { big: "02", tag: "Chapter three", title: "Science and Arts.", text: "At the Higher Secondary level students choose between the Science and Arts streams in Class XI–XII, both under the West Bengal board." },
  { big: "Now", tag: "Chapter four", title: "A school that is also digital.", text: "Notices, timetables, homework, results and attendance live in one student and staff portal — and every student can build a public portfolio page from it." },
];
const N = CHAPTERS.length;

/** 1 while a chapter is "its turn", easing to 0 just before the next one takes over (never two texts on top of each other). */
const fade = (d: number) => {
  const t = Math.max(0, Math.min(1, (0.5 - Math.abs(d)) / 0.16));
  return t * t * (3 - 2 * t);
};

/**
 * Scroll-told story. The section is several screens tall and the stage inside stays pinned. Nothing "switches":
 * every chapter is scrubbed by the scroll position — its text drifts up in layers (label, headline, paragraph move at
 * different speeds), fades in and out, and the big number behind it follows. Same on phones and desktops.
 * (With reduced motion the chapters simply stack as normal text — see home.css.)
 */
export function Story() {
  const [active, setActive] = useState(0);
  const chapters = useRef<(HTMLElement | null)[]>([]);
  const bigs = useRef<(HTMLElement | null)[]>([]);
  const ref = useScrollProgress<HTMLElement>("track", (p) => {
    for (let i = 0; i < N; i++) {
      const d = p * N - (i + 0.5); // −0.5 … +0.5 while chapter i is on stage
      const o = fade(d).toFixed(3);
      const dd = d.toFixed(3);
      for (const el of [chapters.current[i], bigs.current[i]]) {
        if (!el) continue;
        el.style.setProperty("--d", dd);
        el.style.setProperty("--o", o);
      }
    }
    const i = Math.min(N - 1, Math.floor(p * N));
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
              {CHAPTERS.map((c, i) => <span key={c.big} ref={(el) => { bigs.current[i] = el; }} style={{ ["--o" as string]: i === 0 ? 1 : 0 }}>{c.big}</span>)}
            </div>
          </div>
          <div className="story-text">
            <ol className="story-dots" aria-hidden="true">{CHAPTERS.map((c, i) => <li key={c.big} className={i === active ? "on" : i < active ? "done" : ""} />)}</ol>
            <div className="story-chapters">
              {CHAPTERS.map((c, i) => (
                <article key={c.big} ref={(el) => { chapters.current[i] = el; }} className="story-ch" style={{ ["--o" as string]: i === 0 ? 1 : 0 }} aria-current={i === active}>
                  <span className="story-ch-big" aria-hidden="true">{c.big}</span>
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
