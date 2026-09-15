import "./Academics.css";

const STREAMS = [
  {
    tag: "For future engineers, doctors & researchers",
    title: "Science",
    body: "A rigorous foundation in the physical and biological sciences, backed by dedicated laboratory work in Physics, Chemistry and Biology.",
    subjects: ["Physics", "Chemistry", "Biology", "Mathematics", "English", "Environmental Science"],
  },
  {
    tag: "For thinkers, writers & civil servants",
    title: "Arts",
    body: "A humanities education that trains close reading, argument and historical understanding — the critical thinking that underlies law, administration, media and public life.",
    subjects: ["History", "Geography", "Philosophy", "Political Science", "Sanskrit", "Bangla", "English"],
  },
];

export function Academics() {
  return (
    <section className="section" id="academics">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">
            <span className="num">02</span>Academics
          </div>
          <h2>Two streams, one standard of teaching.</h2>
          <p className="lede">
            From Class XI, students choose Science or Arts under the West Bengal Council of Higher Secondary
            Education. Both streams share the same academic seriousness.
          </p>
        </div>
        <div className="stream-grid">
          {STREAMS.map((stream) => (
            <article className="stream-card" key={stream.title}>
              <span className="pill">{stream.tag}</span>
              <h3>{stream.title}</h3>
              <p>{stream.body}</p>
              <ul className="subj-list">
                {stream.subjects.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
