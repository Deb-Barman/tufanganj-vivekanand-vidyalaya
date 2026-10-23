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
  /** Only sent to the Super Admin when listing accounts. */
  locked_until?: string | null;
  failed_login_attempts?: number;
  last_login?: string | null;
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
  /** "upload" | "link" — where the cover picture comes from (cover_image always holds the address to show). */
  source?: "upload" | "link" | null;
  /** How the cover sits in its frame: "x,y,zoom" (empty = centred). */
  cover_adjust?: string;
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
  source?: "upload" | "link" | null;
  /** How the picture sits in its frame: "x,y,zoom" (empty = centred). */
  image_adjust?: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface SchoolForm {
  id: string;
  title: string;
  file: string;
  source?: "upload" | "link" | null;
  /** Direct-download address for Google Drive files (null for anything else). */
  download_url?: string | null;
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
  /** First school day of the session (attendance before it is ignored in the report). */
  start_date?: string | null;
  /** Total working days in the session, e.g. 200. Attendance % is worked out against it. */
  working_days?: number | null;
  /** Minimum attendance % a person should keep; below it they are flagged. */
  attendance_min_percent?: number;
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

/** The teacher's own published "My profile", as shown on a Faculty card (null while the profile is private). */
export interface FacultyCard {
  username: string;
  /** e.g. /profile/teacher/ranjan — the full page. */
  path: string | null;
  photo: string | null;
  photo_adjust: string;
  headline: string;
  qualification: string;
  city: string;
  languages: string[];
  talents: string[];
  about: string;
}

export interface TeacherProfile {
  user: string;
  full_name: string;
  department: string;
  bio: string;
  years_experience: number | null;
  subjects_taught: string[];
  profile: FacultyCard | null;
}

export interface PublicTeacher {
  full_name: string;
  department: string;
  bio: string;
  years_experience: number | null;
  subjects: string[];
  profile: FacultyCard | null;
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

/** One teacher's attendance for one day (taken by the Super Admin). */
export interface TeacherAttendance {
  id: string;
  teacher: string;
  teacher_name: string;
  date: string;
  status: "PRESENT" | "ABSENT";
  marked_by: string | null;
  created_at: string;
}

/** One line of the teacher attendance sheet; status is null until it has been marked for that day. */
export interface TeacherSheetRow {
  teacher: string;
  full_name: string;
  department: string;
  status: "PRESENT" | "ABSENT" | null;
}

export interface Result {
  id: string;
  student: string;
  subject: string;
  session: string;
  /** Which exam: SEM1…SEM4 or ANNUAL. */
  term: ResultTerm;
  marks_obtained: string;
  full_marks: string;
  recorded_by: string | null;
  created_at: string;
}

export type ResultTerm = "SEM1" | "SEM2" | "SEM3" | "SEM4" | "ANNUAL";
export const RESULT_TERMS: { value: ResultTerm; label: string }[] = [
  { value: "SEM1", label: "First Semester" },
  { value: "SEM2", label: "Second Semester" },
  { value: "SEM3", label: "Third Semester" },
  { value: "SEM4", label: "Fourth Semester" },
  { value: "ANNUAL", label: "Annual / Final" },
];
export const termLabel = (t: string) => RESULT_TERMS.find((x) => x.value === t)?.label ?? t;

export interface Marksheet {
  id: string;
  student: string;
  session: string;
  /** Address to open: the uploaded file or the pasted link. */
  file: string | null;
  source?: "upload" | "link" | null;
  generated_at: string;
}

export interface AdminStats {
  people: { students: number; teachers: number; disabled: number; students_without_class: number };
  admissions: { total: number; pending: number; contacted: number; closed: number };
  /** People waiting for the office to set them a new password. */
  password_requests: number;
  content: { notices: number; articles_published: number; articles_drafts: number; events_upcoming: number; gallery: number; forms: number; achievements?: number };
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
  source?: "upload" | "link" | null;
  image_adjust?: string;
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
  /** First day students can tick it off. */
  start_date: string | null;
  /** End date: the last day students can finish it. */
  due_date: string;
  /** upcoming = not started, open = students can tick, closed = end date passed */
  phase: "upcoming" | "open" | "closed";
  /** Student only: true while it is inside its start–end window. */
  can_tick: boolean;
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

export interface HomeworkCompletionRow {
  student: string;
  full_name: string;
  roll_number: string;
  done: boolean;
  completed_at: string | null;
}

export interface HomeworkCompletions {
  homework: string;
  title: string;
  class_name: string;
  students: HomeworkCompletionRow[];
}


/* ───────── Super Admin: Database overview + Data view ───────── */

export interface DbUsage { bytes: number | null; mb: number | null; limit_mb: number; percent: number | null }
export interface StorageBucket { name: string; files: number; bytes: number; mb: number }
export interface DatabaseOverview {
  database: DbUsage;
  storage: { source: "supabase" | "s3" | "disk" | "unavailable"; truncated: boolean; bytes: number; mb: number; files: number; limit_mb: number; percent: number | null; buckets: StorageBucket[] };
  server: { engine: string; version: string | null; connections: number | null; max_connections: number | null; started_at: string | null };
  tables: { key: string; name: string; db_table: string; rows: number; bytes: number | null }[];
  file_columns: { table: string; field: string; uploaded: number }[];
  totals: { tables: number; rows: number };
  dashboard_url: string;
  limits_note: string;
}

export interface DataTableInfo { key: string; app: string; name: string; db_table: string; rows: number; columns: number }
export interface DataTables { tables: DataTableInfo[]; storage_files: number | null; storage_key: string | null }
export type DataFilterType = "text" | "number" | "bool" | "date" | "datetime" | "choice" | "id";
export interface DataColumn {
  name: string; label: string; type: string; redacted: boolean; pk: boolean;
  /** What kind of filter suits this column (null = cannot be filtered). */
  filter: DataFilterType | null;
  choices: { value: string; label: string }[] | null;
}
export interface DataFilter { field: string; op: string; value: string }
export interface DeletePreview {
  count: number;
  blocked: { id: string; label: string; reason: string }[];
  blocked_count: number;
  also: { name: string; count: number }[];
  files: number;
  error: string | null;
  samples: string[];
}
export interface DeleteResult { deleted: number; also_deleted: { name: string; count: number }[]; blocked_count: number; failed: string[] }
export type DataCell = string | number | boolean | null;
export interface DataRows {
  key: string; name: string; db_table: string; columns: DataColumn[]; count: number; page: number; page_size: number; pages: number; ordering: string;
  results: Record<string, DataCell>[];
}


/* ───────────── profiles ───────────── */

/** The signed-in user's own profile (what they edit). */
export interface MyProfile {
  headline: string;
  about: string;
  background: string;
  talents: string[];
  interests: string[];
  achievements: string;
  website: string;
  photo: string | null;
  photo_source: "upload" | "link" | null;
  /** How the photo sits in its round frame: "x,y,zoom" (empty = centred). */
  photo_adjust: string;
  is_public: boolean;
  updated_at: string;
  age: number | null;
  show_age: boolean;
  gender: "" | "male" | "female" | "other";
  show_gender: boolean;
  city: string;
  languages: string[];
  favorite_subject: string;
  career_goal: string;
  qualification: string;
  quote: string;
  projects: string;
  /** site key (instagram, github, …) -> clean https link */
  social_links: Record<string, string>;
  username: string;
  full_name: string;
  role: Role;
  /** e.g. "/profile/student/asha" — null for the Super Admin (no public page). */
  public_path: string | null;
  class_label: string | null;
  department: string | null;
  years_experience: number | null;
}

/** What anyone on the internet can read at /profile/<role>/<username>. */
export interface PublicProfile {
  role: "student" | "teacher";
  username: string;
  full_name: string;
  headline: string;
  about: string;
  background: string;
  talents: string[];
  interests: string[];
  achievements: string;
  website: string;
  photo: string | null;
  photo_adjust?: string;
  updated_at: string;
  city: string;
  languages: string[];
  favorite_subject: string;
  career_goal: string;
  qualification: string;
  quote: string;
  projects: string;
  social_links: Record<string, string>;
  /** only present when the owner chose to show them */
  age: number | null;
  gender: string;
  class_label: string | null;
  department: string | null;
  years_experience: number | null;
}

/* ───────────── bulk import (Excel / CSV) ───────────── */

export interface ImportColumn {
  key: string;
  label: string;
  required: boolean;
  help: string;
}
export interface ImportKind {
  key: string;
  title: string;
  description: string;
  notes: string[];
  chunk_size: number;
  columns: ImportColumn[];
  example: Record<string, string>[];
}
export interface ImportCatalog {
  max_rows: number;
  max_mb: number;
  imports: ImportKind[];
}
export interface ImportRow {
  row: number;
  ok: boolean;
  action: "create" | "update" | "skip" | null;
  display: Record<string, string>;
  errors: string[];
  warnings: string[];
}
export interface ImportPreview {
  key: string;
  file_name: string;
  file_errors: string[];
  unknown_columns: string[];
  total: number;
  counts: { valid: number; invalid: number; create: number; update: number; skip: number };
  chunk_size: number;
  columns: { key: string; label: string }[];
  rows: ImportRow[];
}
export interface ImportCommitResult {
  imported: number;
  created: number;
  updated: number;
  skipped: number;
  rejected: { row: number; errors: string[] }[];
  credentials: { username: string; full_name: string; password: string }[];
}

/* ───────────── attendance report ───────────── */

export type AttendanceStatus = "ok" | "low" | "critical" | "no_data";
export interface AttendanceReportRow {
  id: string;
  name: string;
  username: string;
  group: string;
  roll_number: string;
  present: number;
  absent: number;
  marked: number;
  percent: number | null;
  percent_of_total: number | null;
  days_left: number | null;
  best_possible_percent: number | null;
  status: AttendanceStatus;
}
export interface AttendanceReport {
  kind: "students" | "teachers";
  session: { id: string; label: string; working_days: number | null; min_percent: number; start_date: string | null } | null;
  summary: {
    people: number;
    average_percent: number | null;
    ok: number;
    low: number;
    critical: number;
    no_data: number;
    days_held: number;
    working_days: number | null;
    days_left: number | null;
    percent_of_session_done: number | null;
  };
  rows: AttendanceReportRow[];
}
