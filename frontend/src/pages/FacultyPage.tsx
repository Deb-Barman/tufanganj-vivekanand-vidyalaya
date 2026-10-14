import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../components/site/Avatar";
import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkTeachers } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { PublicTeacher } from "../types/api";

export function FacultyPage() {
  usePageMeta("Faculty", `Meet the teachers of ${SITE.nameFull}.`);
  const { data, error } = usePaged<PublicTeacher>("/academics/teachers/public/", 60);
  return (
    <>
      <PageHero crumb="Faculty" eyebrow="Our faculty" title="The teachers behind every classroom." lede="Each teacher keeps their own profile up to date from the school portal, so what you read here comes from them." />
      <Section>
        {data === null ? (
          <SkTeachers count={6} />
        ) : data.length === 0 ? (
          <EmptyPanel icon="info" title={error ? "The faculty list could not be loaded" : "The faculty directory is being updated"}>
            {error ?? "Teacher profiles will appear here as soon as the school office publishes them."} <Link to="/contact" style={{ color: "var(--accent)", fontWeight: 700 }}>Contact the office</Link> for any question about our staff.
          </EmptyPanel>
        ) : (
          <div className="card-grid">
            {data.map((t, i) => (
              <TeacherCard key={`${t.full_name}-${i}`} teacher={t} index={i} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

const BIO_LIMIT = 170;

/** One teacher. Long bios are folded so a single card never towers over the rest of the grid. */
function TeacherCard({ teacher: t, index }: { teacher: PublicTeacher; index: number }) {
  const [open, setOpen] = useState(false);
  const long = !!t.bio && t.bio.length > BIO_LIMIT;
  return (
    <article className="feature teacher-feature" data-reveal style={{ ["--d" as string]: index % 4 }}>
      <Avatar name={t.full_name} size={58} />
      <h3>{t.full_name}</h3>
      {t.department && <span className="pill">{t.department}</span>}
      {t.years_experience ? <p className="t-exp">{t.years_experience} years of teaching experience</p> : null}
      {t.bio && <p className={`t-bio${long && !open ? " clamped" : ""}`}>{t.bio}</p>}
      {long && (
        <button type="button" className="t-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </article>
  );
}
