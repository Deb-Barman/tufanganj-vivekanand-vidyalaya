import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import type { MyProfile } from "../../types/api";
import { Avatar, EmptyState, Icon, PageHeader, Skeleton, StatusPill, errText, useUI } from "../ui/kitExports";
import "./profile.css";

type Draft = Pick<MyProfile, "headline" | "about" | "background" | "talents" | "interests" | "achievements" | "website">;
const pick = (p: MyProfile): Draft => ({ headline: p.headline, about: p.about, background: p.background, talents: p.talents, interests: p.interests, achievements: p.achievements, website: p.website });
const ROLE_WORD = { SUPER_ADMIN: "Super Admin", TEACHER: "Teacher", STUDENT: "Student" } as const;

/** Add/remove short items (talents, interests) — Enter or comma adds, × removes. */
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

export function ProfileModule() {
  const { user } = useAuth();
  const { toast, confirm } = useUI();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
  if (!profile || !draft) return (<><PageHeader icon="user" title="My profile" /><Skeleton rows={4} /></>);

  const dirty = JSON.stringify(draft) !== JSON.stringify(pick(profile));
  const canPublish = profile.public_path !== null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
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
    if (next && !(await confirm({ title: "Make your profile public?", message: "Anyone on the internet with your link will be able to read the page below: your name, class or department, photo and everything you wrote here. Your phone, e-mail, marks and attendance are never shown. You can switch it off at any time.", confirmLabel: "Make public" }))) return;
    try {
      setProfile(await api.patch<MyProfile>("/auth/me/profile/", { is_public: next }));
      toast("success", next ? "Your profile is now public." : "Your profile is now private.");
    } catch (e) {
      toast("error", errText(e, "Could not change visibility."));
    }
  }

  async function uploadPhoto(f: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast("error", "Please choose a JPEG, PNG or WebP photo.");
    if (f.size > 5 * 1024 * 1024) return toast("error", "That photo is larger than 5 MB.");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", f);
      const r = await api.postForm<{ photo: string }>("/auth/me/profile/photo/", fd);
      setProfile((p) => (p ? { ...p, photo: r.photo } : p));
      toast("success", "Photo updated.");
    } catch (e) {
      toast("error", errText(e, "Could not upload the photo."));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removePhoto() {
    try {
      await api.del("/auth/me/profile/photo/");
      setProfile((p) => (p ? { ...p, photo: null } : p));
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

  const facts = profile.role === "STUDENT" ? profile.class_label : [profile.department, profile.years_experience ? `${profile.years_experience} yrs experience` : ""].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader icon="user" title="My profile" sub={canPublish ? "Tell people who you are. Choose whether to publish it as a public page." : "Your account details."} actions={dirty && (<button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>)} />

      <section className="panel pf-head">
        <div className="pf-photo">
          {profile.photo ? <img src={profile.photo} alt="Your profile photo" /> : <Avatar name={profile.full_name} size={96} />}
          <div className="pf-photo-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : profile.photo ? "Change photo" : "Add photo"}</button>
            {profile.photo && <button type="button" className="link-btn" onClick={removePhoto}>Remove</button>}
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); }} />
          </div>
        </div>
        <div className="pf-id">
          <h2>{profile.full_name}</h2>
          <p>@{profile.username} · {ROLE_WORD[user?.role ?? profile.role]}{facts ? ` · ${facts}` : ""}</p>
          <small>Name, class and department come from the school office. Ask them if something is wrong.</small>
        </div>
      </section>

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
          <div className="form-field"><label htmlFor="pfHead">Headline <small className="pf-count">{draft.headline.length}/120</small></label><input id="pfHead" value={draft.headline} maxLength={120} placeholder={profile.role === "TEACHER" ? "e.g. Physics teacher who loves experiments" : "e.g. Class XI student · robotics and chess"} onChange={(e) => set("headline", e.target.value)} /></div>
          <div className="form-field"><label htmlFor="pfAbout">About me <small className="pf-count">{draft.about.length}/1200</small></label><textarea id="pfAbout" rows={5} value={draft.about} maxLength={1200} placeholder="A few lines about you — what you enjoy, what you want to become." onChange={(e) => set("about", e.target.value)} /></div>
          <div className="form-field"><label htmlFor="pfBg">Background <small className="pf-count">{draft.background.length}/1500</small></label><textarea id="pfBg" rows={5} value={draft.background} maxLength={1500} placeholder={profile.role === "TEACHER" ? "Education, training, previous schools…" : "Where you come from, schools, what shaped you…"} onChange={(e) => set("background", e.target.value)} /></div>
          <ChipInput id="pfTal" label="Talents & skills" hint="e.g. Python, Drawing, Singing — press Enter" value={draft.talents} onChange={(v) => set("talents", v)} />
          <ChipInput id="pfInt" label="Interests" hint="e.g. Robotics, Cricket — press Enter" value={draft.interests} onChange={(v) => set("interests", v)} />
          <div className="form-field"><label htmlFor="pfAch">Achievements <small className="pf-count">{draft.achievements.length}/1500</small></label><textarea id="pfAch" rows={4} value={draft.achievements} maxLength={1500} placeholder="Prizes, projects, competitions, publications…" onChange={(e) => set("achievements", e.target.value)} /></div>
          <div className="form-field"><label htmlFor="pfWeb">Website or portfolio (optional)</label><input id="pfWeb" type="url" inputMode="url" value={draft.website} maxLength={200} placeholder="https://" onChange={(e) => set("website", e.target.value)} /></div>
        </div>
      </section>

      <div className="sticky-save">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : dirty ? "Save changes" : "All saved"}</button>
      </div>
    </>
  );
}
