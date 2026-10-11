import { useEffect, useState } from "react";
import type { AcademicSession, SchoolClass, Subject, TeacherProfile } from "../../types/api";
import { listAll } from "./kitHelpers";

/** Sessions, classes, subjects (and optionally teachers) — the reference data most staff pages need. */
export function useRefData(withTeachers = false) {
  const [d, setD] = useState<{ sessions: AcademicSession[]; classes: SchoolClass[]; subjects: Subject[]; teachers: TeacherProfile[] } | null>(null);
  useEffect(() => {
    Promise.all([
      listAll<AcademicSession>("/academics/sessions/"),
      listAll<SchoolClass>("/academics/classes/"),
      listAll<Subject>("/academics/subjects/"),
      withTeachers ? listAll<TeacherProfile>("/academics/teachers/") : Promise.resolve([] as TeacherProfile[]),
    ])
      .then(([sessions, classes, subjects, teachers]) => setD({ sessions, classes, subjects, teachers }))
      .catch(() => setD({ sessions: [], classes: [], subjects: [], teachers: [] }));
  }, [withTeachers]);
  return d;
}
