import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { SOCIAL_SITES } from "../../lib/mediaLinks";
import type { MyProfile } from "../../types/api";
import { SocialIcon } from "../../components/site/SocialIcon";
import { PersonPhoto } from "../../components/media/PersonPhoto";
import { EmptyState, Icon, PageHeader, Select, Skeleton, StatusPill, errText, useUI } from "../ui/kitExports";
import { MediaSourceField } from "../ui/MediaSourceField";
import { emptyMedia, mediaChosen, mediaInvalid } from "../ui/mediaHelpers";
import type { MediaValue } from "../ui/mediaHelpers";
import { AchievementsEditor, ProjectsEditor, SkillsEditor, VisibilityPanel } from "./ProfilePortfolio";
import { strength } from "./profileStrength";
import "./profile.css";

const FIELDS = ["headline", "about", "background", "talents", "interests", "achievements", "website", "age", "show_age", "gender", "show_gender", "city", "languages", "favorite_subject", "career_goal", "qualification", "quote", "projects", "social_links", "skills", "project_list", "achievement_items", "learning", "visibility", "results_mode"] as const;
type Draft = Pick<MyProfile, (typeof FIELDS)[number]>;
const pick = (p: MyProfile): Draft => Object.fromEntries(FIELDS.map((k) => [k, p[k]])) as Draft;
const ROLE_WORD = { SUPER_ADMIN: "Super Admin", TEACHER: "Teacher", STUDENT: "Student" } as const;

/** Add/remove short items (talents, interests, languages) — Enter or comma adds, × removes. */
function ChipInput({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().replace(/,$/, "").slice(0, 40);
    if (t && value.length < 12 && !value.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="form-field">
      <label htmlFor={id}>{label} <small className="pf-count">{value.length}/12</small></label>
      <div className="pf-chips">
        {value.map((t) => (
          <span key={t} className="pf-chip">{t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><Icon name="x" size={12} /></button></span>
        ))}
        {value.length < 12 && <input id={id} value={text} maxLength={40} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={value.length ? "Add another…" : hint} enterKeyHint="done" />}
      </div>
    </div>
  );
}

const Text = ({ id, label, value, max, onChange, placeholder }: { id: string; label: string; value: string; max: number; onChange: (v: string) => void; placeholder?: string }) => (
  <div className="form-field"><label htmlFor={id}>{label} <small className="pf-count">{value.length}/{max}</small></label><input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></div>
);

export function ProfileModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photo, setPhoto] = useState<MediaValue>(emptyMedia);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoAdjust, setPhotoAdjust] = useState("");

  useEffect(() => {
    let alive = true;
    api.get<MyProfile>("/auth/me/profile/").then(
      (p) => { if (alive) { setProfile(p); setDraft(pick(p)); } },
      (e) => { if (alive) { setFailed(true); toast("error", errText(e, "Could not load your profile.")); } },
    );
    return () => {
      alive = false;
    };
  }, [toast]);

  if (failed) return <EmptyState icon="alert" title="Your profile could not be loaded" text="Check your connection and open this page again." />;
  if (!profile || !draft) return (<><PageHeader icon="user" title="My profile" sub={user?.role === "SUPER_ADMIN" ? "Your account details." : "Tell people who you are. Choose whether to publish it as a public page."} /><Skeleton variant="profile" /></>);

  const dirty = JSON.stringify(draft) !== JSON.stringify(pick(profile));
  const canPublish = profile.public_path !== null;
  const isStudent = profile.role === "STUDENT";
  const isTeacher = profile.role === "TEACHER";
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const setSocial = (k: string, v: string) => setDraft({ ...draft, social_links: { ...draft.social_links, [k]: v } });
  const link = profile.public_path ? `${window.location.origin}${profile.public_path}` : "";

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const p = await api.patch<MyProfile>("/auth/me/profile/", draft);
      setProfile(p);
      setDraft(pick(p));
      toast("success", "Profile saved.");
    } catch (e) {
      toast("error", errText(e, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublic() {
    if (!profile) return;
    const next = !profile.is_public;
    if (next && !(await confirm({ title: "Make your profile public?", message: "Anyone on the internet with your link will be able to read the page below: your name, class or department, photo and everything you wrote here. Your phone, e-mail and guardian details are never shown. Your marks and attendance stay hidden unless you switch them on under “Who can see what”, and age and gender stay hidden unless you tick them. You can switch it off at any time.", confirmLabel: "Make public" }))) return;
    try {
      setProfile(await api.patch<MyProfile>("/auth/me/profile/", { is_public: next }));
      toast("success", next ? "Your profile is now public." : "Your profile is now private.");
    } catch (e) {
      toast("error", errText(e, "Could not change visibility."));
    }
  }

  async function savePhoto() {
    setPhotoBusy(true);
    try {
      // Profile pictures are never uploaded: the person pastes a link (e.g. from their own Google Drive) and positions it.
      const body: Record<string, string> = { photo_adjust: photoAdjust };
      if (photo.link.trim()) body.photo_link = photo.link.trim();
      await api.patch("/auth/me/profile/", body);
      const fresh = await api.get<MyProfile>("/auth/me/profile/");
      setProfile(fresh); // photo only — leave unsaved text edits alone
      setPhoto(emptyMedia);
      setPhotoOpen(false);
      toast("success", "Photo updated.");
    } catch (e) {
      toast("error", errText(e, "Could not update the photo."));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    try {
      await api.del("/auth/me/profile/photo/");
      setProfile((p) => (p ? { ...p, photo: null, photo_source: null, photo_adjust: "" } : p));
    } catch (e) {
      toast("error", errText(e, "Could not remove the photo."));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast("success", "Link copied.");
    } catch {
      toast("info", link);
    }
  }

  const facts = isStudent ? profile.class_label : [profile.department, profile.years_experience ? `${profile.years_experience} yrs experience` : ""].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader icon="user" title="My profile" sub={canPublish ? "Tell people who you are. Choose whether to publish it as a public page." : "Your account details."} actions={dirty && (<button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>)} />

      <section className="panel pf-head">
        <div className="pf-photo">
          <PersonPhoto name={profile.full_name} src={profile.photo} adjust={profile.photo_adjust} size={96} />
          <div className="pf-photo-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setPhotoAdjust(profile.photo_adjust ?? ""); setPhoto(emptyMedia); setPhotoOpen((o) => !o); }}>{profile.photo ? "Change photo" : "Add photo"}</button>
            {profile.photo && <button type="button" className="link-btn" onClick={removePhoto}>Remove</button>}
          </div>
        </div>
        <div className="pf-id">
          <h2>{profile.full_name}</h2>
          <p>@{profile.username} · {ROLE_WORD[user?.role ?? profile.role]}{facts ? ` · ${facts}` : ""}</p>
          <small>Name, class and department come from the school office. Ask them if something is wrong.</small>
        </div>
        {photoOpen && (
          <div className="pf-photo-edit">
            <MediaSourceField
              kind="image"
              idPrefix="pfPhoto"
              label="Profile photo — paste a picture link"
              linkOnly
              value={photo}
              onChange={setPhoto}
              current={profile.photo ? { url: profile.photo, source: profile.photo_source } : undefined}
              adjust={{ value: photoAdjust, onChange: setPhotoAdjust, shape: "circle" }}
            />
            <div className="pf-photo-go">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPhotoOpen(false); setPhoto(emptyMedia); }}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={savePhoto} disabled={photoBusy || mediaInvalid("image", photo) || (!mediaChosen(photo) && photoAdjust === (profile.photo_adjust ?? ""))}>{photoBusy ? "Saving…" : mediaChosen(photo) ? "Use this photo" : "Save position"}</button>
            </div>
          </div>
        )}
      </section>

      {canPublish && (() => {
        const st = strength(draft, !!profile.photo);
        return (
          <section className="panel pf-strength" aria-label="Portfolio strength">
            <div className="pf-strength-top"><b>Portfolio strength</b><span>{st.percent}%</span></div>
            <div className="pf-meter" role="progressbar" aria-valuenow={st.percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${st.percent}%` }} /></div>
            <p>{st.missing.length === 0 ? "Complete! Your page tells a full story." : `Add ${st.missing.slice(0, 3).join(", ")}${st.missing.length > 3 ? " and more" : ""} to make it stronger.`}</p>
          </section>
        );
      })()}

      {canPublish ? (
        <section className="panel pf-publish">
          <div>
            <b>Public page</b> <StatusPill tone={profile.is_public ? "good" : "muted"}>{profile.is_public ? "Public" : "Private"}</StatusPill>
            <p>{profile.is_public ? "Anyone with this link can read your profile." : "Only you can see this for now. Turn it on when you are happy with it."}</p>
            <code className="pf-link">{link}</code>
          </div>
          <div className="pf-publish-actions">
            <button type="button" className={`btn btn-sm ${profile.is_public ? "btn-outline" : "btn-primary"}`} onClick={togglePublic}>{profile.is_public ? "Make private" : "Make public"}</button>
            <a className="btn btn-outline btn-sm" href={profile.public_path ?? "#"} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} /> View page</a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>Copy link</button>
          </div>
        </section>
      ) : (
        <p className="pf-note">The Super Admin account has no public page, for security. This page keeps your own account details.</p>
      )}

      <section className="panel">
        <div className="panel-title"><h3>About you</h3></div>
        <p className="pf-warn"><Icon name="shield" size={15} /> This can be public. Never write phone numbers, e-mail addresses or your home address — they are rejected automatically.</p>
        <div className="stack" style={{ gap: 14 }}>
          <Text id="pfHead" label="Headline" value={draft.headline} max={120} placeholder={isTeacher ? "e.g. Physics teacher who loves experiments" : "e.g. Class XI student · robotics and chess"} onChange={(v) => set("headline", v)} />
          <div className="form-field"><label htmlFor="pfAbout">About me <small className="pf-count">{draft.about.length}/1200</small></label><textarea id="pfAbout" rows={5} value={draft.about} maxLength={1200} placeholder="A few lines about you — what you enjoy, what you want to become." onChange={(e) => set("about", e.target.value)} /></div>
          <Text id="pfQuote" label="Favourite quote or motto" value={draft.quote} max={200} placeholder="Something that inspires you" onChange={(v) => set("quote", v)} />
          <div className="form-field"><label htmlFor="pfBg">Background <small className="pf-count">{draft.background.length}/1500</small></label><textarea id="pfBg" rows={5} value={draft.background} maxLength={1500} placeholder={isTeacher ? "Education, training, previous schools…" : "Where you come from, schools, what shaped you…"} onChange={(e) => set("background", e.target.value)} /></div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><h3>Quick facts</h3></div>
        <div className="form-grid">
          <Text id="pfCity" label="Town / city" value={draft.city} max={80} placeholder="e.g. Tufanganj" onChange={(v) => set("city", v)} />
          {isStudent && <Text id="pfFav" label="Favourite subject" value={draft.favorite_subject} max={60} placeholder="e.g. Physics" onChange={(v) => set("favorite_subject", v)} />}
          {isStudent && <Text id="pfGoal" label="What I want to become" value={draft.career_goal} max={120} placeholder="e.g. Robotics engineer" onChange={(v) => set("career_goal", v)} />}
          {isTeacher && <Text id="pfQual" label="Qualification" value={draft.qualification} max={120} placeholder="e.g. M.Sc. Physics, B.Ed." onChange={(v) => set("qualification", v)} />}
        </div>
        <div className="stack" style={{ gap: 14, marginTop: 14 }}>
          <ChipInput id="pfLang" label="Languages I speak" hint="e.g. Bengali, English — press Enter" value={draft.languages} onChange={(v) => set("languages", v)} />
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="pfAge">Age</label>
              <input id="pfAge" type="number" inputMode="numeric" min={4} max={100} value={draft.age ?? ""} onChange={(e) => set("age", e.target.value === "" ? null : Number(e.target.value))} placeholder="e.g. 16" />
              <label className="pf-show"><input type="checkbox" checked={draft.show_age} onChange={(e) => set("show_age", e.target.checked)} /> Show my age on my public page</label>
            </div>
            <div className="form-field">
              <label htmlFor="pfGender">Gender</label>
              <Select id="pfGender" value={draft.gender} onChange={(e) => set("gender", e.target.value as Draft["gender"])}>
                <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </Select>
              <label className="pf-show"><input type="checkbox" checked={draft.show_gender} onChange={(e) => set("show_gender", e.target.checked)} /> Show my gender on my public page</label>
            </div>
          </div>
          <p className="pf-note" style={{ margin: 0 }}>Age and gender are private unless you tick “show”. You can untick at any time.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><h3>Skills &amp; interests</h3></div>
        <div className="stack" style={{ gap: 16 }}>
          <SkillsEditor value={draft.skills} onChange={(v) => set("skills", v)} />
          <ChipInput id="pfTal" label="Talents (short tags)" hint="e.g. Drawing, Singing — press Enter" value={draft.talents} onChange={(v) => set("talents", v)} />
          <ChipInput id="pfInt" label="Interests & hobbies" hint="e.g. Robotics, Cricket — press Enter" value={draft.interests} onChange={(v) => set("interests", v)} />
          <ChipInput id="pfLearn" label="Currently learning" hint="e.g. Machine learning — press Enter" value={draft.learning} onChange={(v) => set("learning", v)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-title"><h3>Projects</h3></div>
        <p className="pf-note">Show what you have built. Add a GitHub link or a page that explains the project — visitors can open it from your profile.</p>
        <ProjectsEditor value={draft.project_list} onChange={(v) => set("project_list", v)} />
        <div className="form-field" style={{ marginTop: 14 }}><label htmlFor="pfProj">Other work (optional) <small className="pf-count">{draft.projects.length}/1500</small></label><textarea id="pfProj" rows={3} value={draft.projects} maxLength={1500} placeholder="Anything that does not fit a project card" onChange={(e) => set("projects", e.target.value)} /></div>
      </section>

      <section className="panel">
        <div className="panel-title"><h3>Achievements &amp; certificates</h3></div>
        <AchievementsEditor value={draft.achievement_items} onChange={(v) => set("achievement_items", v)} />
        <div className="form-field" style={{ marginTop: 14 }}><label htmlFor="pfAch">Other achievements (optional) <small className="pf-count">{draft.achievements.length}/1500</small></label><textarea id="pfAch" rows={3} value={draft.achievements} maxLength={1500} placeholder="Anything else you are proud of" onChange={(e) => set("achievements", e.target.value)} /></div>
      </section>

      <section className="panel">
        <div className="panel-title"><h3>Social media &amp; links</h3></div>
        <p className="pf-note">Type just your @username or paste the profile link — the site's logo is shown automatically on your public page. Only public profile links are accepted (no phone numbers).</p>
        <div className="pf-social">
          {SOCIAL_SITES.map((s) => (
            <div className="pf-social-row form-field" key={s.key}>
              <span className="pf-social-ico" title={s.label}><SocialIcon name={s.key} size={20} /></span>
              <input aria-label={`${s.label} link or username`} value={draft.social_links[s.key] ?? ""} maxLength={300} placeholder={`${s.label} — ${s.hint}`} onChange={(e) => setSocial(s.key, e.target.value)} inputMode="url" autoCapitalize="none" spellCheck={false} />
            </div>
          ))}
        </div>
      </section>

      {canPublish && (
        <section className="panel">
          <div className="panel-title"><h3>Who can see what</h3></div>
          <VisibilityPanel
            draft={draft}
            isStudent={isStudent}
            onVisibility={(key, on) => setDraft({ ...draft, visibility: { ...draft.visibility, [key]: on } })}
            onMode={(m) => set("results_mode", m)}
          />
        </section>
      )}

      <div className="sticky-save">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : dirty ? "Save changes" : "All saved"}</button>
      </div>
    </>
  );
}
