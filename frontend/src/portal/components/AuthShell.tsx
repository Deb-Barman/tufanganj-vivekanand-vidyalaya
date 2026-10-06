import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SchoolLogo } from "../../components/SchoolLogo";
import "./AuthShell.css";

interface Props {
  variant: "staff" | "admin";
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared login layout: animated aurora + floating orbs behind a glass card
 * with a rotating neon border. `variant` swaps the colour system
 * (staff = lilac/teal, admin = amber/rose). Now only used by the forced
 * "set a new password" page; the login pages have their own designs.
 */
export function AuthShell({ variant, title, subtitle, children, footer }: Props) {
  return (
    <div className={`auth auth-${variant}`}>
      <div className="auth-bg" aria-hidden="true">
        <div className="aurora"><i /><i /><i /></div>
        <span className="orb o1" /><span className="orb o2" /><span className="orb o3" />
        <span className="spark s1" /><span className="spark s2" /><span className="spark s3" /><span className="spark s4" />
      </div>

      <div className="auth-stage">
        <div className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-logo" aria-hidden="true">
              <span className="auth-logo-ring" />
              <SchoolLogo size={56} />
            </div>
            <h1>{title}</h1>
            <p className="auth-sub">{subtitle}</p>
            {children}
            {footer}
          </div>
        </div>

        <Link to="/" className="auth-back">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          Back to school website
        </Link>
      </div>
    </div>
  );
}
