import "./Campus.css";

const FACILITIES = [
  { title: "Science Laboratories", body: "Dedicated Physics, Chemistry and Biology labs for hands-on practical work." },
  { title: "Computer Centre", body: "A working computer lab for digital literacy and introductory programming." },
  { title: "Library", body: "A quiet reading room with reference texts, journals and set literature." },
];

export function Campus({ bare = false }: { bare?: boolean }) {
  return (
    <section className={bare ? "section bare" : "section"} id="campus">
      <div className="wrap">
        {!bare && (
<div className="section-head" data-reveal>
          <div className="eyebrow">
            <span className="num">05</span>Campus &amp; Facilities
          </div>
          <h2>Beyond the classroom.</h2>
          <p className="lede">A school is more than lessons. Our campus gives students room to run, build, read and compete.</p>
        </div>
        )}
        <div className="campus-grid">
          <article className="campus-main lift" data-reveal="left">
            <span className="pill">Sports &amp; Athletics</span>
            <h3>A genuinely large playing field</h3>
            <p>
              Physical education matters here as much as academics. Our grounds host daily cricket and football,
              plus an annual inter-class football tournament that runs from Class V through XII, and a full Annual
              Sports Day each year.
            </p>
          </article>
          <div className="campus-side">
            {FACILITIES.map((f, i) => (
              <article className="campus-mini lift" key={f.title} data-reveal="right" style={{ ["--d" as string]: i }}>
                <h4>{f.title}</h4>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
