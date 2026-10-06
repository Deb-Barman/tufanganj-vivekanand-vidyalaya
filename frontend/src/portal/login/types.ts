import type { LoginPortal } from "../../lib/AuthContext";

/** Props shared by every login design, so a new one can be dropped in later. */
export interface LoginViewProps {
  portal: LoginPortal;
  initialNotice?: string;
  onSigningIn: (active: boolean) => void;
  onSuccess: () => void;
}
