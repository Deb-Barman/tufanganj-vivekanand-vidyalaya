import { Link } from "react-router-dom";
import { EmptyState } from "../ui/kit";
import { dashPath } from "../ui/nav";

/** Shown for an unknown /portal/dashboard/... address, so the page is never blank. */
export function DashboardNotFound() {
  return (
    <EmptyState
      icon="alert"
      title="This page does not exist"
      text="The address may be mistyped, or your role may not have this page."
      action={<Link className="btn btn-primary btn-sm" to={dashPath("")}>Back to the dashboard</Link>}
    />
  );
}
