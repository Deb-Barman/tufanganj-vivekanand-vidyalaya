import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PersonPhoto } from "../components/media/PersonPhoto";
import { ProfileFinderForm } from "../components/ProfileFinderForm";
import { PageHero, Section } from "../components/site/PageHero";
import { SITE } from "../config/site";
import { api } from "../lib/api";
import { usePageMeta } from "../lib/usePageMeta";
import "./FindProfile.css";

interface Found {
  found: boolean;
  role?: "teacher" | "student";
  username?: string;
  full_name?: string;
  headline?: string;
  photo?: string | null;
  photo_adjust?: string;
  path?: string;
}

/** Profile Finder: anyone can look up a teacher or student by their exact username. Only published profiles are found. */
export function FindProfilePage() {
  usePageMeta("Profile Finder", `Find a teacher or student profile of ${SITE.nameFull} by username.`);
  const [params] = useSearchParams();
  const name = (params.get("u") ?? "").trim().replace(/^@/, "");
  const [state, setState] = useState<{ for: string; result: Found | null; error: boolean } | null>(null);

  useEffect(() => {
    if (name.length < 2) return;
    let live = true;
    api
      .get<Found>(`/auth/profiles/find/?u=${encodeURIComponent(name)}`, { auth: false })
      .then((result) => live && setState({ for: name, result, error: false }))
      .catch(() => live && setState({ for: name, result: null, error: true }));
    return () => {
      live = false;
    };
  }, [name]);

  const loading = name.length >= 2 && state?.for !== name;
  const r = state?.for === name ? state.result : null;

  return (
    <>
      <PageHero crumb="Profile Finder" eyebrow="Profile Finder" title="Find a teacher or student." lede="Type a username to open that person's public profile. Only profiles their owners have chosen to publish can be found." />
      <Section>
        <div className="fp-wrap">
          <ProfileFinderForm initial={name} id="fp-main" autoFocus={!name} />
          <p className="fp-tip">Usernames are given by the school office — ask the person for theirs. Spelling must match exactly.</p>

          {name.length > 0 && name.length < 2 && <p className="fp-note">Type at least 2 letters.</p>}
          {loading && <div className="fp-card fp-skel" aria-busy="true" aria-label="Searching" />}

          {r?.found && r.path && (
            <Link to={r.path} className="fp-card fp-hit">
              <PersonPhoto name={r.full_name ?? ""} src={r.photo} adjust={r.photo_adjust} size={84} zoomable={false} />
              <span className="fp-text">
                <span className="fp-role">{r.role === "teacher" ? "Teacher" : "Student"} · @{r.username}</span>
                <strong>{r.full_name}</strong>
                {r.headline && <span className="fp-headline">{r.headline}</span>}
                <span className="fp-go">View full profile <i aria-hidden="true">→</i></span>
              </span>
            </Link>
          )}

          {state?.for === name && !state.error && r && !r.found && (
            <div className="fp-card fp-miss" role="status">
              <strong>No public profile found for “{name}”.</strong>
              <span>The username may be spelled differently, or that person has not published their profile yet.</span>
            </div>
          )}
          {state?.for === name && state.error && (
            <div className="fp-card fp-miss" role="status">
              <strong>The search could not be completed.</strong>
              <span>The school server may be waking up — please try again in a minute.</span>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
