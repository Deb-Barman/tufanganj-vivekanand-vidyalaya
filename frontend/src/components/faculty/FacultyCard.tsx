import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PersonPhoto } from "../media/PersonPhoto";
import type { FacultyCard as Card } from "../../types/api";
import "./faculty-card.css";

export interface FacultyCardProps {
  name: string;
  department?: string;
  years?: number | null;
  /** The bio the school office keeps (used when the teacher has not published their own profile). */
  bio?: string;
  subjects?: string[];
  /** The teacher's own published "My profile" — null when it is private. */
  card: Card | null;
  /** Extra buttons for the Super Admin (they sit outside the link, so pressing them never opens the profile). */
  actions?: ReactNode;
  index?: number;
  /** Fade in on scroll (public website only). */
  reveal?: boolean;
}

const BIO_LIMIT = 170;

/**
 * One teacher, as a professional card. It is built from what the teacher wrote in their own "My profile" (photo,
 * headline, qualification…). Tap the card → their full public profile page. Used on the public website and in the portal.
 */
export function FacultyCard({ name, department, years, bio, subjects = [], card, actions, index = 0, reveal = false }: FacultyCardProps) {
  const [open, setOpen] = useState(false);
  const link = card?.path ?? null;
  const headline = card?.headline || department || "Teacher";
  const about = card?.about || bio || "";
  const long = !link && about.length > BIO_LIMIT; // linked cards fold the text; the full page has all of it
  const facts = [card?.qualification, years ? `${years} yr${years === 1 ? "" : "s"} experience` : "", card?.city].filter(Boolean) as string[];
  const tags = subjects.length ? subjects : card?.talents ?? [];

  const body = (
    <>
      <span className="fc-band" aria-hidden="true" />
      <span className="fc-photo"><PersonPhoto name={name} src={card?.photo} adjust={card?.photo_adjust} size={92} zoomable={false} /></span>
      <span className="fc-id">
        <strong className="fc-name">{name}</strong>
        <span className="fc-headline">{headline}</span>
      </span>
      {facts.length > 0 && <span className="fc-facts">{facts.map((f) => <span key={f} className="fc-fact">{f}</span>)}</span>}
      {about && <span className={`fc-about${long && !open ? " clamped" : ""}${link ? " clamped" : ""}`}>{about}</span>}
      {tags.length > 0 && <span className="fc-tags">{tags.slice(0, 5).map((t) => <span key={t} className="fc-tag">{t}</span>)}{tags.length > 5 && <span className="fc-tag more">+{tags.length - 5}</span>}</span>}
      {card && card.languages.length > 0 && <span className="fc-lang">{card.languages.join(" · ")}</span>}
    </>
  );

  return (
    <article className={`fc${link ? " is-link" : ""}`} {...(reveal ? { "data-reveal": true } : {})} style={{ ["--d" as string]: index % 4 }}>
      {link ? (
        <Link to={link} className="fc-main" aria-label={`${name} — view full profile`}>
          {body}
          <span className="fc-go">View full profile <i aria-hidden="true">→</i></span>
        </Link>
      ) : (
        <div className="fc-main">
          {body}
          {long && <button type="button" className="fc-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Show less" : "Read more"}</button>}
          <span className="fc-soon">Full profile not published yet</span>
        </div>
      )}
      {actions && <div className="fc-actions">{actions}</div>}
    </article>
  );
}
