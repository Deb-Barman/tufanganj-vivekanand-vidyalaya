import { Link } from "react-router-dom";
import { FacultyCard } from "../components/faculty/FacultyCard";
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
      <PageHero crumb="Faculty" eyebrow="Teachers & staff" title="The teachers behind every classroom." lede="Each teacher keeps their own profile up to date from the school portal, so what you read here comes from them. Tap a teacher to read their full profile." />
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
              <FacultyCard key={`${t.full_name}-${i}`} reveal index={i} name={t.full_name} department={t.department} years={t.years_experience} bio={t.bio} subjects={t.subjects} card={t.profile} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
