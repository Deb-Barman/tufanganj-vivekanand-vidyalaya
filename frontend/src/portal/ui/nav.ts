import type { Role } from "../../types/api";
import type { IconName } from "./icons";

export interface NavItem {
  to: string; // relative to /portal/dashboard
  label: string;
  icon: IconName;
  roles: Role[];
  group: string;
  hint: string; // shown in the command palette
}

const ALL: Role[] = ["SUPER_ADMIN", "TEACHER", "STUDENT"];
const STAFF: Role[] = ["SUPER_ADMIN", "TEACHER"];
const ADMIN: Role[] = ["SUPER_ADMIN"];

export const NAV: NavItem[] = [
  { to: "", label: "Overview", icon: "home", roles: ALL, group: "Home", hint: "Your dashboard" },
  { to: "profile", label: "My profile", icon: "user", roles: ALL, group: "Home", hint: "Your details and public profile page" },

  { to: "notices", label: "Notices", icon: "megaphone", roles: ALL, group: "Communicate", hint: "Publish and read notices" },
  { to: "events", label: "Events", icon: "calendar", roles: ALL, group: "Communicate", hint: "School calendar" },
  { to: "admissions", label: "Admissions", icon: "inbox", roles: ADMIN, group: "Communicate", hint: "Enquiries from the website" },
  { to: "messages", label: "Messages", icon: "mail", roles: ADMIN, group: "Communicate", hint: "Messages sent from the Contact page" },

  { to: "blog", label: "Blog", icon: "book", roles: ALL, group: "Website", hint: "Articles on the public site" },
  { to: "gallery", label: "Gallery", icon: "image", roles: ALL, group: "Website", hint: "Photos" },
  { to: "downloads", label: "Downloads", icon: "download", roles: ALL, group: "Website", hint: "Forms and documents" },
  { to: "achievements", label: "Achievements", icon: "award", roles: ADMIN, group: "Website", hint: "Add results and awards to the website" },

  { to: "timetable", label: "Timetable", icon: "clock", roles: ALL, group: "Academics", hint: "Weekly class timetable" },
  { to: "homework", label: "Homework", icon: "clipboard", roles: ALL, group: "Academics", hint: "Set or view homework" },
  { to: "exams", label: "Exams", icon: "calendar", roles: ALL, group: "Academics", hint: "Exam schedule" },
  { to: "attendance", label: "Attendance", icon: "checkCircle", roles: ALL, group: "Academics", hint: "Mark or view attendance" },
  { to: "results", label: "Results", icon: "award", roles: ALL, group: "Academics", hint: "Enter or view marks" },
  { to: "marksheets", label: "Marksheets", icon: "file", roles: ALL, group: "Academics", hint: "Upload or download marksheets" },
  { to: "attendance-report", label: "Attendance report", icon: "trend", roles: ADMIN, group: "Academics", hint: "Attendance % and who needs attention" },
  { to: "academics", label: "Classes & Subjects", icon: "layers", roles: ADMIN, group: "Academics", hint: "Sessions, classes, subjects" },

  { to: "students", label: "Students", icon: "cap", roles: STAFF, group: "People", hint: "Student profiles and classes" },
  { to: "teachers", label: "Faculty", icon: "school", roles: ALL, group: "People", hint: "Teacher directory" },
  { to: "accounts", label: "Accounts", icon: "users", roles: ADMIN, group: "People", hint: "Create logins and set passwords" },

  { to: "import", label: "Bulk import", icon: "file", roles: ADMIN, group: "System", hint: "Upload Excel or CSV instead of typing" },
  { to: "database", label: "Database", icon: "database", roles: ADMIN, group: "System", hint: "Supabase storage and database usage" },
  { to: "data", label: "Data view", icon: "table", roles: ADMIN, group: "System", hint: "Browse every table, read-only" },
];

export function navFor(role: Role): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role));
}

export function groupNav(items: NavItem[]): { group: string; items: NavItem[] }[] {
  const out: { group: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const g = out.find((x) => x.group === item.group);
    if (g) g.items.push(item);
    else out.push({ group: item.group, items: [item] });
  }
  return out;
}

export const dashPath = (to: string) => (to ? `/portal/dashboard/${to}` : "/portal/dashboard");
