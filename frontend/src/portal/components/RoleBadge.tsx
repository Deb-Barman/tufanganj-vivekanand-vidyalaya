import type { Role } from "../../types";

const LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`role-badge role-${role.toLowerCase()}`}>{LABELS[role]}</span>;
}
