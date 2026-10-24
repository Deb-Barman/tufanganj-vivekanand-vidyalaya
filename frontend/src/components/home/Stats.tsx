import { CountUp } from "../portfolio/CountUp";

const ITEMS: { n: number | string; suffix?: string; label: string }[] = [
  { n: 1964, label: "Year established" },
  { n: "V–XII", label: "Classes taught" },
  { n: 2, label: "H.S. streams" },
  { n: 30, suffix: "+", label: "Subject-specialist teachers" },
];

/** Big numbers that count up as the band scrolls into view. */
export function Stats() {
  return (
    <section className="st" aria-label="The school in numbers">
      <div className="wrap st-grid">
        {ITEMS.map((s, i) => (
          <div className="st-item" key={s.label} data-reveal style={{ ["--d" as string]: i }}>
            <b>{typeof s.n === "number" ? <CountUp to={s.n} suffix={s.suffix ?? ""} duration={1500} /> : s.n}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
