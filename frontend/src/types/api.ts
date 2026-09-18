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
  created_by: string | null;
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

export interface StudentProfile {
  user: string;
  full_name: string;
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
