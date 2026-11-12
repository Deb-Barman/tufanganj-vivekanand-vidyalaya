import { Link } from "react-router-dom";
import { Fragment, useEffect, useRef, useState } from "react";
import { SchoolLogo } from "./SchoolLogo";
import { Magnetic } from "./home/Magnetic";
import { useScrollProgress } from "./home/scroll";
import "./Hero.css";

/** Counts from 0 to `to` once the element scrolls into view. */
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function CountUp({ to, pad = 0 }: { to: number; pad?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Reduced-motion users see the final number immediately — no animation, no effect needed.
  const [val, setVal] = useState(() => (prefersReducedMotion() ? to : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const dur = 1600;
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / dur);
          setVal(Math.round(to * (1 - Math.pow(1 - p, 4))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);

  return <span ref={ref}>{String(val).padStart(pad, "0")}</span>;
}

/** Headline words rise out of a mask one after another. Plain text for screen readers (the words stay in normal order). */
function Words({ text, start = 0, className = "" }: { text: string; start?: number; className?: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <Fragment key={i}>
          <span className="wm"><span className={`w ${className}`} style={{ ["--i" as string]: start + i }}>{w}</span></span>{" "}
        </Fragment>
      ))}
    </>
  );
}

export function Hero() {
  const ref = useScrollProgress<HTMLElement>("exit");
  // The light follows the mouse and the emblem tilts toward it (mouse devices only; touch and reduced motion skip it).
  const point = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    el.style.setProperty("--ry", `${((x - 0.5) * 16).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 12).toFixed(2)}deg`);
  };
  return (
    <section className="hero" ref={ref} onPointerMove={point}>
      <div className="aurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="wrap hero-inner">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow" data-reveal>
            <span className="status-dot" /> TUFANGANJ, COOCH BEHAR · EST. 1964
          </p>
          <h1 aria-label="Tufanganj Vivekananda Vidyalaya (H.S.): sixty years in Tufanganj, one student at a time.">
            <Words text="Sixty years in Tufanganj," />
            <br />
            <Words text="one student" start={4} /> <span className="serif-word"><Words text="at a time." start={6} className="grad-shimmer" /></span>
          </h1>
          <p className="hero-description" data-reveal style={{ ["--d" as string]: 2 }}>
            Tufanganj Vivekananda Vidyalaya (H.S.) has taught this town&apos;s children since 1964 — through Class V to XII,
            in Science and Arts, on the field and in the lab.
          </p>
          <div className="hero-cta-row" data-reveal style={{ ["--d" as string]: 3 }}>
            <Magnetic><Link to="/admissions" className="btn btn-primary">
              Start Admission Enquiry
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link></Magnetic>
            <Magnetic><Link to="/portal" className="btn btn-outline">
              Student &amp; Staff Login
            </Link></Magnetic>
          </div>
        </div>

        {/* Decorative animated emblem — desktop only, hidden from assistive tech */}
        <div className="hero-visual" aria-hidden="true" data-reveal="zoom" style={{ ["--d" as string]: 2 }}>
          <div className="hv-disc">
            <svg viewBox="0 0 200 200">
              <circle className="hv-trk" cx="100" cy="100" r="95" />
              <circle className="hv-prg" cx="100" cy="100" r="95" />
            </svg>
            <div className="hv-orbit"><i /><i /></div>
            <div className="hv-core">
              <SchoolLogo size={120} />
            </div>
            <span className="hv-est">Est.<strong>1964</strong></span>
          </div>
          <span className="hv-chip c1"><i />Science</span>
          <span className="hv-chip c2"><i />Arts</span>
          <span className="hv-chip c3"><i />Class V – XII</span>
        </div>
      </div>

      <div className="hero-cue" aria-hidden="true"><span><i /></span>Scroll</div>

      <div className="hero-bottom">
        <div className="wrap hero-quote-strip" data-reveal>
          <p>&ldquo;Take up one idea. Make that one idea your life — think of it, dream of it, live on that idea.&rdquo;</p>
          <span>Swami Vivekananda — after whom this Vidyalaya is named</span>
        </div>
        <div className="wrap hero-stats">
          <div className="hero-stat" data-reveal style={{ ["--d" as string]: 0 }}>
            <div className="n"><CountUp to={1964} /></div>
            <div className="l">Year established</div>
          </div>
          <div className="hero-stat" data-reveal style={{ ["--d" as string]: 1 }}>
            <div className="n">V–XII</div>
            <div className="l">Classes taught</div>
          </div>
          <div className="hero-stat" data-reveal style={{ ["--d" as string]: 2 }}>
            <div className="n"><CountUp to={2} /></div>
            <div className="l">H.S. streams — Science &amp; Arts</div>
          </div>
        </div>
      </div>
    </section>
  );
}
