import { useScrollProgress } from "./scroll";

const A = ["Knowledge", "Character", "Progress", "Science", "Arts", "Class V – XII", "Since 1964", "Tufanganj"];
const B = ["Arise", "Awake", "Stop not", "Till the goal is reached", "Vivekananda", "Vidyalaya", "H.S."];

function Row({ words, outline }: { words: string[]; outline?: boolean }) {
  const strip = [...words, ...words, ...words];
  return (
    <div className={`mq-row${outline ? " outline" : ""}`}>
      <div className="mq-strip">
        {strip.map((w, i) => (
          <span key={i}>{w}<i aria-hidden="true">✦</i></span>
        ))}
      </div>
    </div>
  );
}

/** Two huge lines of words that slide in opposite directions as the page scrolls. */
export function Marquee() {
  const ref = useScrollProgress<HTMLElement>("view");
  return (
    <section className="mq" ref={ref} aria-label="Knowledge, Character, Progress">
      <Row words={A} />
      <Row words={B} outline />
    </section>
  );
}
