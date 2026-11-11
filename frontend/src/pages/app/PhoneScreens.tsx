import type { ReactNode } from "react";

/* Live (HTML/CSS) copies of the real app's screens, drawn in a phone frame. They use a made-up student
   ("Ananya Mukherjee") and sample numbers — never a real pupil's name or marks. Everything scales with the
   phone's width because every size below is in em. */

const DEMO = { name: "Ananya Mukherjee", first: "Ananya", user: "ananya", initials: "AM", klass: "Class 7" };

const PATHS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  timetable: "M4 6h16v12H4zM8 6v12M12 6v12M16 6v12",
  homework: "M9 4h6v3H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12h6M9 16h4",
  attendance: "M5 4h14v16H5zM9 9l1.5 1.5L13 8M9 15h6",
  results: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4",
  megaphone: "M4 10v4l10 4V6zM14 8l5-2v12l-5-2M7 15l1 4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  book: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  doc: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  exam: "M5 4h14v16H5zM9 9a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6M11 16h.01",
  wifioff: "M3 3l18 18M8.5 8.5A9 9 0 0 1 21 11M5 12a9 9 0 0 1 3-2M9 16a5 5 0 0 1 6 0M12 20h.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  chevron: "M9 6l6 6-6 6",
  download: "M12 3v12M7 11l5 5 5-5M5 21h14",
  shield: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  phone: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2",
  share: "M12 3v12M8 7l4-4 4 4M5 13v7h14v-7",
  plus: "M12 5v14M5 12h14",
};
export function Ico({ n, className = "ic" }: { n: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[n] ?? PATHS.check} />
    </svg>
  );
}

/** The phone itself. `children` are absolutely-positioned screens (`<Screen>`). */
export function Phone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`apph ${className}`} aria-hidden="true">
      <div className="apph-body">
        <i className="apph-btn apph-b1" /><i className="apph-btn apph-b2" /><i className="apph-btn apph-b3" />
        <div className="apph-screen">
          <i className="apph-cam" />
          {children}
        </div>
      </div>
    </div>
  );
}

function Status({ pct = 89, time = "9:41" }: { pct?: number; time?: string }) {
  return (
    <div className="sc-status"><b>{time}</b><span>{pct}%<i className="sc-batt"><u style={{ width: `${pct}%` }} /></i></span></div>
  );
}

function Ring({ pct, children, size = "5em" }: { pct: number; children?: ReactNode; size?: string }) {
  const C = 2 * Math.PI * 42;
  return (
    <span className="sc-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" className="t" /><circle cx="50" cy="50" r="42" className="v" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} /></svg>
      <span>{children}</span>
    </span>
  );
}

const Tabs = ({ on = 0, avatar = false }: { on?: number; avatar?: boolean }) => (
  <div className="sc-tabs">
    {["home", "timetable", "homework", "attendance"].map((n, i) => <span key={n} className={i === on ? "on" : ""}><Ico n={n} /></span>)}
    <span className={`me${avatar ? " on" : ""}`}>{DEMO.initials}</span>
  </div>
);

/* ───── 1 · Splash ───── */
export function SplashScreen() {
  return (
    <div className="sc sc-splash">
      <Status time="9:40" />
      <div className="sp-logo"><img src="/school_logo.png" alt="" width="320" height="320" decoding="async" /></div>
      <h4>Tufanganj Vivekanand Vidyalaya (H.S.)</h4>
      <p>Knowledge · Character · Progress</p>
      <div className="sp-bar"><i /></div>
      <small>Opening your school…</small>
    </div>
  );
}

/* ───── 2 · Home (also used for the "offline" chapter) ───── */
export function HomeScreen({ offline = false }: { offline?: boolean }) {
  const stories: [string, string][] = [["timetable", "Timetable"], ["homework", "Homework"], ["attendance", "Attendance"], ["results", "Results"]];
  return (
    <div className="sc sc-home">
      <Status />
      <div className="hm-top"><span className="hm-logo"><img src="/school_logo.png" alt="" width="64" height="64" /></span><b>TVV School</b><Ico n="megaphone" className="ic hm-mega" /></div>
      {offline && <div className="hm-off"><Ico n="wifioff" /><span>You are offline — showing your last saved data.</span></div>}
      <div className="hm-stories">{stories.map(([n, l]) => <div key={n}><span className="sc-rg"><span><Ico n={n} /></span></span><em>{l}</em></div>)}</div>
      <div className="hm-hi"><span className="sc-rg big"><span>{DEMO.initials}</span></span><div><small>Good morning</small><b>{DEMO.first}</b><u>{DEMO.klass}</u></div></div>
      <div className="hm-card">
        <div className="hm-card-h"><span className="sc-ico"><Ico n="attendance" /></span><div><b>Attendance</b><small>9 of 12</small></div></div>
        <div className="hm-card-b"><Ring pct={75}><b>75%</b><small>attendance</small></Ring><div><u>75% so far</u><small>Tap to see your calendar and recent days.</small></div></div>
      </div>
      <div className="hm-h"><b>Today’s classes</b><span>Timetable</span></div>
      {[["Mathematics", "10:00"], ["Bengali", "10:45"], ["Science", "11:30"]].map(([s, t]) => <div className="hm-row" key={s}><i /><b>{s}</b><small>{t}</small></div>)}
      <Tabs />
    </div>
  );
}

/* ───── 3 · Projects ───── */
export function ProjectsScreen() {
  const rows: [string, string, string, "warn" | "good" | "info" | "muted", boolean][] = [
    ["Solar system model", "Science · First Semester", "3 days left", "warn", false],
    ["Bengali essay: My village", "Bengali · First Semester", "Due tomorrow", "warn", false],
    ["Map of West Bengal", "Geography", "Finished", "good", true],
    ["Maths puzzle sheet", "Mathematics", "Starts 18 Nov", "info", false],
    ["Plant growth diary", "Science", "12 days left", "muted", false],
  ];
  return (
    <div className="sc sc-proj">
      <Status />
      <div className="pj-top"><b>Projects</b><small>Your class projects with their start date and deadline.</small></div>
      <div className="pj-prog"><span><b>1</b> of 5 done</span><div><i style={{ width: "20%" }} /></div></div>
      {rows.map(([t, m, s, tone, done]) => (
        <div className="pj-row" key={t}>
          <span className={`pj-chk${done ? " on" : ""}`}>{done && <Ico n="check" />}</span>
          <div><b className={done ? "sc-strike" : ""}>{t}</b><small>{m}</small></div>
          <em className={`sc-pill ${tone}`}>{s}</em>
        </div>
      ))}
      <Tabs on={2} />
    </div>
  );
}

/* ───── 4 · Results ───── */
export function ResultsScreen() {
  const subs: [string, number][] = [["Bengali", 78], ["English", 84], ["Mathematics", 91], ["Science", 88], ["History", 72]];
  return (
    <div className="sc sc-res">
      <Status />
      <div className="pj-top"><b>Results</b><small>Marks by term</small></div>
      <div className="rs-tabs"><span className="on">First Semester</span><span>Second</span><span>Annual</span></div>
      <div className="rs-sum"><Ring pct={83} size="5.6em"><b>83%</b><small>overall</small></Ring><div><u>Grade A</u><small>Subject-wise marks for this term.</small></div></div>
      {subs.map(([s, m]) => (
        <div className="rs-row" key={s}><div><b>{s}</b><small>{m} / 100</small></div><div className="sc-bar"><i style={{ width: `${m}%` }} /></div></div>
      ))}
      <Tabs on={3} />
    </div>
  );
}

/* ───── 5 · Menu ───── */
export function MenuScreen() {
  const items: [string, string, string][] = [["results", "Results", "Marks by term"], ["doc", "Marksheets", "Official marksheets"], ["exam", "Exam schedule", "Dates, rooms and times"], ["book", "Class & subjects", "Your class and subjects"], ["megaphone", "Notices", "School announcements"], ["calendar", "Events", "What’s coming up"]];
  return (
    <div className="sc sc-menu">
      <Status />
      <div className="mn-top"><b>Menu</b><Ico n="megaphone" className="ic hm-mega" /></div>
      <div className="mn-me"><span className="sc-rg big"><span>{DEMO.initials}</span></span><div><b>{DEMO.name}</b><small>@{DEMO.user}</small><small>Student · Tufanganj Vivekananda Vidyalaya</small></div></div>
      {items.map(([n, t, s]) => <div className="mn-row" key={t}><Ico n={n} /><div><b>{t}</b><small>{s}</small></div><Ico n="chevron" className="ic ch" /></div>)}
      <Tabs avatar />
    </div>
  );
}
