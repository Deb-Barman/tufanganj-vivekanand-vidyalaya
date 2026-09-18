import "./TrustBar.css";

const ITEMS = [
  "West Bengal Board affiliated",
  "30+ teachers, all subject specialists",
  "Serving Tufanganj since 1964",
  "Class V to XII under one roof",
];

export function TrustBar() {
  return (
    <section className="trust-bar" id="about">
      <div className="wrap trust-bar-inner">
        {ITEMS.map((item) => (
          <div className="trust-item" key={item}>
            <span className="dot" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
