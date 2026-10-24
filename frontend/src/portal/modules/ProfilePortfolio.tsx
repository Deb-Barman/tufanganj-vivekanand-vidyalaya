import { useState } from "react";
import type { AchievementKind, MyProfile, PortfolioAchievement, PortfolioProject, PortfolioSkill, SectionKey } from "../../types/api";
import { Icon, Select } from "../ui/kitExports";

/* The portfolio editors for My profile: skills with levels, project cards, achievement cards, what visitors can see. */

const LEVELS = ["Beginner", "Learning", "Good", "Strong", "Expert"];

export function SkillsEditor({ value, onChange }: { value: PortfolioSkill[]; onChange: (v: PortfolioSkill[]) => void }) {
  const update = (i: number, patch: Partial<PortfolioSkill>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="form-field">
      <label>Skills with a level <small className="pf-count">{value.length}/12</small></label>
      <div className="pe-list">
        {value.map((s, i) => (
          <div className="pe-skill" key={i}>
            <input aria-label="Skill name" value={s.name} maxLength={40} placeholder="e.g. Python" onChange={(e) => update(i, { name: e.target.value })} />
            <div className="pe-levels" role="radiogroup" aria-label={`Level of ${s.name || "this skill"}`}>
              {LEVELS.map((l, n) => (
                <button type="button" key={l} role="radio" aria-checked={s.level === n + 1} className={s.level >= n + 1 ? "on" : ""} title={l} aria-label={l} onClick={() => update(i, { level: n + 1 })} />
              ))}
              <span className="pe-level-name">{LEVELS[s.level - 1]}</span>
            </div>
            <button type="button" className="pe-x" aria-label={`Remove ${s.name || "skill"}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
          </div>
        ))}
        {value.length < 12 && <button type="button" className="btn btn-outline btn-sm pe-add" onClick={() => onChange([...value, { name: "", level: 3 }])}><Icon name="plus" size={15} /> Add a skill</button>}
      </div>
    </div>
  );
}

function ProjectRow({ p, onChange, onRemove }: { p: PortfolioProject; onChange: (p: PortfolioProject) => void; onRemove: () => void }) {
  const [tags, setTags] = useState(p.tags.join(", "));
  return (
    <div className="pe-card">
      <div className="pe-card-head"><b>{p.title || "New project"}</b><button type="button" className="pe-x" aria-label="Remove this project" onClick={onRemove}><Icon name="x" size={14} /></button></div>
      <div className="form-field"><label>Project name <small className="pf-count">{p.title.length}/80</small></label><input value={p.title} maxLength={80} placeholder="e.g. Weather bot" onChange={(e) => onChange({ ...p, title: e.target.value })} /></div>
      <div className="form-field"><label>What it does <small className="pf-count">{p.summary.length}/400</small></label><textarea rows={3} value={p.summary} maxLength={400} placeholder="One or two lines: what you built and what you learned." onChange={(e) => onChange({ ...p, summary: e.target.value })} /></div>
      <div className="form-grid">
        <div className="form-field"><label>Link (GitHub or details page)</label><input value={p.link} maxLength={300} placeholder="https://github.com/you/project" inputMode="url" autoCapitalize="none" spellCheck={false} onChange={(e) => onChange({ ...p, link: e.target.value })} /></div>
        <div className="form-field"><label>Tags (comma separated)</label><input value={tags} maxLength={120} placeholder="Python, Robotics" onChange={(e) => { setTags(e.target.value); onChange({ ...p, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5) }); }} /></div>
      </div>
    </div>
  );
}

export function ProjectsEditor({ value, onChange }: { value: PortfolioProject[]; onChange: (v: PortfolioProject[]) => void }) {
  return (
    <div className="pe-list">
      {value.map((p, i) => <ProjectRow key={i} p={p} onChange={(np) => onChange(value.map((x, j) => (j === i ? np : x)))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />)}
      {value.length < 8 && <button type="button" className="btn btn-outline btn-sm pe-add" onClick={() => onChange([...value, { title: "", summary: "", link: "", tags: [] }])}><Icon name="plus" size={15} /> Add a project</button>}
    </div>
  );
}

const KINDS: { value: AchievementKind; label: string }[] = [
  { value: "award", label: "Award / prize" }, { value: "competition", label: "Competition" }, { value: "certificate", label: "Certificate / course" },
  { value: "activity", label: "Club / activity" }, { value: "other", label: "Other" },
];

export function AchievementsEditor({ value, onChange }: { value: PortfolioAchievement[]; onChange: (v: PortfolioAchievement[]) => void }) {
  const update = (i: number, patch: Partial<PortfolioAchievement>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div className="pe-list">
      {value.map((a, i) => (
        <div className="pe-card" key={i}>
          <div className="pe-card-head"><b>{a.title || "New achievement"}</b><button type="button" className="pe-x" aria-label="Remove this achievement" onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button></div>
          <div className="form-field"><label>Title <small className="pf-count">{a.title.length}/100</small></label><input value={a.title} maxLength={100} placeholder="e.g. 2nd prize, District Science Fair" onChange={(e) => update(i, { title: e.target.value })} /></div>
          <div className="form-grid">
            <div className="form-field"><label>Type</label><Select value={a.kind} onChange={(e) => update(i, { kind: e.target.value as AchievementKind })}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></div>
            <div className="form-field"><label>Year</label><input value={a.year} inputMode="numeric" maxLength={4} placeholder="2026" onChange={(e) => update(i, { year: e.target.value.replace(/\D/g, "") })} /></div>
          </div>
          <div className="form-field"><label>Details (optional) <small className="pf-count">{a.detail.length}/300</small></label><input value={a.detail} maxLength={300} placeholder="What it was for, or what you did" onChange={(e) => update(i, { detail: e.target.value })} /></div>
        </div>
      ))}
      {value.length < 15 && <button type="button" className="btn btn-outline btn-sm pe-add" onClick={() => onChange([...value, { title: "", year: "", kind: "award", detail: "" }])}><Icon name="plus" size={15} /> Add an achievement</button>}
    </div>
  );
}

/* ───────────── who can see what ───────────── */

const SECTION_ROWS: { key: SectionKey; title: string; text: string; studentOnly?: boolean }[] = [
  { key: "about", title: "About me & quote", text: "Your introduction and favourite quote." },
  { key: "quick_facts", title: "Quick facts", text: "Town, favourite subject, goal, languages, and age/gender if you ticked them." },
  { key: "skills", title: "Skills, talents & interests", text: "Skill levels, talents, hobbies, what you are learning." },
  { key: "projects", title: "Projects", text: "Your project cards with their links." },
  { key: "achievements", title: "Achievements", text: "Prizes, certificates, clubs and activities." },
  { key: "background", title: "Background", text: "Where you come from and what shaped you." },
  { key: "social", title: "Social links & website", text: "The logos and links you added." },
  { key: "results", title: "My results", text: "Class → semester → subject marks from the school's records.", studentOnly: true },
  { key: "attendance", title: "Attendance & homework habit", text: "A 12-month attendance calendar, streaks and homework completion.", studentOnly: true },
];

export function VisibilityPanel({ draft, isStudent, onVisibility, onMode }: {
  draft: Pick<MyProfile, "visibility" | "results_mode">;
  isStudent: boolean;
  onVisibility: (key: SectionKey, on: boolean) => void;
  onMode: (m: "summary" | "full") => void;
}) {
  return (
    <div className="pv">
      <p className="pf-note">Choose what visitors of your public page can see. Switched-off sections are removed from the page <b>by the server</b>, not just hidden. Your phone, e-mail and guardian details are never shown.</p>
      <ul className="pv-list">
        {SECTION_ROWS.filter((r) => isStudent || !r.studentOnly).map((r) => {
          const on = draft.visibility[r.key];
          return (
            <li key={r.key} className={r.studentOnly ? "school" : ""}>
              <label className="pv-row">
                <span className="pv-text"><b>{r.title}</b><small>{r.text}</small></span>
                <input type="checkbox" role="switch" className="pv-switch" checked={on} onChange={(e) => onVisibility(r.key, e.target.checked)} aria-label={`Show ${r.title} on my public page`} />
              </label>
              {r.key === "results" && on && (
                <div className="pv-sub" role="radiogroup" aria-label="How much of my results to show">
                  <button type="button" role="radio" aria-checked={draft.results_mode === "summary"} className={draft.results_mode === "summary" ? "on" : ""} onClick={() => onMode("summary")}><b>Percentages only</b><small>Overall % for each semester. No subjects, no marks.</small></button>
                  <button type="button" role="radio" aria-checked={draft.results_mode === "full"} className={draft.results_mode === "full" ? "on" : ""} onClick={() => onMode("full")}><b>Every subject &amp; mark</b><small>Subject-wise marks for every semester of every class.</small></button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {isStudent && <p className="pf-note pv-foot"><Icon name="shield" size={14} /> Results and attendance are <b>off</b> until you switch them on. Think about who you share your link with — you can switch them off again at any time.</p>}
    </div>
  );
}
