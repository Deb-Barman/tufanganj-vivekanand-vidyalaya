import { Link } from "react-router-dom";
import { DEVELOPER } from "../../config/developer";
import "./DeveloperNote.css";

/** One quiet line that credits the developer, so anyone reading any page can find out who built the site. */
export function DeveloperNote() {
  return (
    <aside className="dev-note" aria-label="Website developer">
      <span className="dev-note-av" aria-hidden="true">{DEVELOPER.initials}</span>
      <p>
        This website and student portal were designed and developed by <strong>{DEVELOPER.name}</strong> — {DEVELOPER.role}.{" "}
        <Link to="/developer">About the developer →</Link>
      </p>
    </aside>
  );
}
