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

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiErrorShape {
  detail?: string;
  [field: string]: unknown;
}
