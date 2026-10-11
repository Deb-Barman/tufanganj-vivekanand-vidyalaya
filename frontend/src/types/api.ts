export type Role = "SUPER_ADMIN" | "TEACHER" | "STUDENT";

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  phone: string;
  email: string;
  is_active_account: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  target_class: string;
  created_by?: string | null; // not sent by the public API
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  cover_image: string | null;
  published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  event_date: string;
  audience: string;
  created_by: string | null;
  created_at: string;
}

export interface GalleryImage {
  id: string;
  caption: string;
  image: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface SchoolForm {
  id: string;
  title: string;
  file: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface Admission {
  id: string;
  applicant_name: string;
  guardian_contact: string;
  applying_for_class: string;
  message: string;
  status: "PENDING" | "CONTACTED" | "CLOSED";
  submitted_at: string;
}

export interface AcademicSession {
  id: string;
  label: string;
  is_current: boolean;
}

export interface SchoolClass {
  id: string;
  name: string;
  stream: string;
  session: string;
}

export interface Subject {
  id: string;
  name: string;
  school_class: string;
}

export interface TeacherProfile {
  user: string;
  full_name: string;
  department: string;
  bio: string;
  years_experience: number | null;
  subjects_taught: string[];
}

export interface PublicTeacher {
  full_name: string;
  department: string;
  bio: string;
  years_experience: number | null;
}

export interface StudentProfile {
  user: string;
  full_name: string;
  username?: string;
  school_class: string | null;
  roll_number: string;
  guardian_name: string;
  guardian_contact: string;
}

export interface Attendance {
  id: string;
  student: string;
  date: string;
  status: "PRESENT" | "ABSENT";
  marked_by: string | null;
  created_at: string;
}

export interface Result {
  id: string;
  student: string;
  subject: string;
  session: string;
  marks_obtained: string;
  full_marks: string;
  recorded_by: string | null;
  created_at: string;
}

export interface Marksheet {
  id: string;
  student: string;
  session: string;
  file: string | null;
  generated_at: string;
}

export interface AdminStats {
  people: { students: number; teachers: number; disabled: number; awaiting_first_login: number; students_without_class: number };
  admissions: { total: number; pending: number; contacted: number; closed: number };
  content: { notices: number; articles_published: number; articles_drafts: number; events_upcoming: number; gallery: number; forms: number };
  academics: { sessions: number; classes: number; subjects: number; current_session: string | null };
  attendance: {
    today: { present: number; absent: number; marked: number };
    last7: { date: string; present: number; absent: number }[];
  };
  recent_admissions: { id: string; applicant_name: string; applying_for_class: string; status: Admission["status"]; submitted_at: string }[];
  recent_notices: { id: string; title: string; created_at: string }[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  year: number;
  category: "ACADEMIC" | "SPORTS" | "ARTS" | "OTHER";
  image: string | null;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "NEW" | "READ" | "REPLIED";
  created_at: string;
}

export interface TimetableEntry {
  id: string;
  school_class: string;
  weekday: number;
  period: number;
  start_time: string;
  end_time: string;
  subject: string | null;
  subject_name: string;
  label: string;
  teacher: string | null;
  teacher_name: string;
  room: string;
}

export interface Homework {
  id: string;
  school_class: string;
  class_name: string;
  subject: string;
  subject_name: string;
  title: string;
  details: string;
  due_date: string;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
  done: boolean | null;
  submitted: number | null;
  class_size: number | null;
}

export interface Exam {
  id: string;
  school_class: string;
  class_name: string;
  subject: string;
  subject_name: string;
  name: string;
  date: string;
  start_time: string | null;
  room: string;
}
