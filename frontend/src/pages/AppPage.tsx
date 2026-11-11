import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { EmptyPanel } from "../components/site/PageHero";
import { SkRowCards } from "../components/loading/Loading";
import { useScrollProgress } from "../components/home/scroll";
import { SITE } from "../config/site";
import { usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { AppPlatform, AppRelease } from "../types/api";
import { HomeScreen, Ico, MenuScreen, Phone, ProjectsScreen, ResultsScreen, SplashScreen } from "./app/PhoneScreens";
import "./app-page.css";

/** Chrome / Edge / Samsung Internet fire this when the site can be installed like an app. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Device = "ios" | "android" | "windows" | "mac" | "other";
function detectDevice(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh/i.test(ua)) return "mac";
  return "other";
}
const DEVICE_PLATFORM: Record<Device, AppPlatform | null> = { ios: "IOS", android: "ANDROID", windows: "WINDOWS", mac: "MAC", other: null };
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** "56" → "56 MB" (people often type just the number); anything else is shown as typed. */
const sizeText = (s: string) => (/^\d+(\.\d+)?$/.test(s.trim()) ? `${s.trim()} MB` : s.trim());
const versionText = (v: string) => v.trim().replace(/^v(?=\d)/i, "");
const href = (a: AppRelease) => a.download_url ?? a.download_link;

const CHAPTERS = [
  { tag: "Launch", title: "Opens in a blink.", text: "One tap on the school seal and you are in — no clutter, no waiting around.", screen: <SplashScreen /> },
  { tag: "Home", title: "Your whole day on one screen.", text: "Timetable, homework, attendance and results are one tap away, and today’s classes are already waiting for you.", screen: <HomeScreen /> },
  { tag: "Projects", title: "Projects with real deadlines.", text: "See what has started, what is due and how many days are left. Tick a project off the moment you finish it.", screen: <ProjectsScreen /> },
  { tag: "Results", title: "Marks, always at hand.", text: "Results by semester with a bar for every subject — and the official marksheets are in the menu.", screen: <ResultsScreen /> },
  { tag: "Menu", title: "Notices, exams, events.", text: "School announcements, the exam schedule and what is coming up — gathered in one tidy menu.", screen: <MenuScreen /> },
  { tag: "Offline", title: "Works without the network.", text: "Lost your signal? The app keeps showing your last saved data until you are back online.", screen: <HomeScreen offline /> },
];
const N = CHAPTERS.length;
const fade = (d: number) => {
  const t = Math.max(0, Math.min(1, (0.5 - Math.abs(d)) / 0.16));
  return t * t * (3 - 2 * t);
};
const cross = (d: number) => Math.max(0, Math.min(1, (0.62 - Math.abs(d)) / 0.2));

const FEATURES = [
  { i: "timetable", t: "Timetable", d: "Every period of today and the whole week." },
  { i: "homework", t: "Homework", d: "What is due, tick it off when it is done." },
  { i: "layers", t: "Projects", d: "Start dates, deadlines and days left." },
  { i: "attendance", t: "Attendance", d: "Your percentage and a calendar of recent days." },
  { i: "results", t: "Results & marksheets", d: "Marks by semester, subject by subject." },
  { i: "megaphone", t: "Notices & events", d: "Announcements and what is coming up." },
  { i: "wifioff", t: "Works offline", d: "Shows your last saved data without a network." },
  { i: "shield", t: "Private & secure", d: "Sign in with your own school username." },
];

const STEPS = [
  { i: "download", t: "Tap Download", d: "The file is saved to your phone’s Downloads." },
  { i: "bolt", t: "Open the file", d: "If Android asks, allow installs from your browser — just this once." },
  { i: "user", t: "Sign in", d: "Use the username and password your school gave you." },
];

const FAQ = [
  { q: "Is the app free?", a: "Yes. It is the school’s own app, made for its students, teachers and parents." },
  { q: "Why does my phone ask for permission to install?", a: "The app comes straight from the school’s website instead of the Play Store, so Android asks you to allow installs from your browser. Allow it for this app, then you can switch the permission off again." },
  { q: "How do I sign in?", a: "With the same username and password you use on the school portal. If you forgot it, use “Forgot password” on the sign-in screen or ask your class teacher." },
  { q: "Will I get the updates?", a: "When a new version is published it appears on this page. Download it and install it over the old one — your data stays." },
  { q: "I have an iPhone.", a: "Use “Add to home screen” below: the website opens like an app, with its own icon." },
];

export function AppPage() {
  usePageMeta("App", `Download the ${SITE.nameFull} app — timetable, homework, projects, attendance and results on your phone.`);
  const { data, error } = usePaged<AppRelease>("/content/apps/public/", 50);
  const device = useMemo(() => detectDevice(), []);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
    setPrompt(null);
  }

  const mine = DEVICE_PLATFORM[device];
  const apps = useMemo(() => [...(data ?? [])].sort((a, b) => Number(b.platform === mine) - Number(a.platform === mine)), [data, mine]);
  const main = apps[0];

  /* ── scroll-driven pieces (all use the site's shared, damped scroll engine) ── */
  const progress = useScrollProgress<HTMLDivElement>("page");
  const hero = useScrollProgress<HTMLElement>("exit");
  const steps = useScrollProgress<HTMLOListElement>("view");

  const [active, setActive] = useState(0);
  const chapters = useRef<(HTMLElement | null)[]>([]);
  const screens = useRef<(HTMLElement | null)[]>([]);
  const story = useScrollProgress<HTMLElement>("track", (p) => {
    for (let i = 0; i < N; i++) {
      const d = p * N - (i + 0.5);
      const ch = chapters.current[i];
      if (ch) {
        ch.style.setProperty("--d", d.toFixed(3));
        ch.style.setProperty("--o", fade(d).toFixed(3));
      }
      const sc = screens.current[i];
      if (sc) {
        sc.style.setProperty("--d", d.toFixed(3));
        sc.style.setProperty("--o", cross(d).toFixed(3));
      }
    }
    const i = Math.min(N - 1, Math.floor(p * N));
    setActive((cur) => (cur === i ? cur : i));
  });

  const goDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("download")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="ap">
      <div className="ap-progress" ref={progress} aria-hidden="true"><div /></div>

      {/* ═════════ HERO ═════════ */}
      <header className="ap-hero" ref={hero}>
        <div className="ap-aurora" aria-hidden="true"><i /><i /><i /></div>
        <div className="wrap ap-hero-grid">
          <div className="ap-hero-copy">
            <span className="ap-eyebrow"><i /> The official school app</span>
            <h1>Your whole school, <span className="ap-grad">in your pocket.</span></h1>
            <p className="ap-lede">Timetable, homework, projects, attendance and results — one tap away, even when the network is not.</p>
            <div className="ap-cta-row">
              {main ? (
                <a className="ap-cta" href={href(main)} target="_blank" rel="noopener noreferrer">
                  <span className="ap-cta-ico"><Ico n="download" /></span>
                  <span className="ap-cta-txt"><b>{main.platform === "WEB" ? "Open the app" : `Download for ${main.platform_label}`}</b><small>{[main.version && `v${versionText(main.version)}`, main.size_text && sizeText(main.size_text)].filter(Boolean).join(" · ") || "Free"}</small></span>
                </a>
              ) : (
                <a className="ap-cta" href="#download" onClick={goDownload}>
                  <span className="ap-cta-ico"><Ico n="phone" /></span>
                  <span className="ap-cta-txt"><b>Add to home screen</b><small>Works on any phone</small></span>
                </a>
              )}
              <a className="ap-ghost" href="#how" onClick={(e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }}>See how it works <Ico n="chevron" /></a>
            </div>
            <ul className="ap-trust" aria-label="Highlights"><li><Ico n="check" /> Free</li><li><Ico n="check" /> No ads</li><li><Ico n="check" /> Made by the school</li></ul>
          </div>
          <div className="ap-hero-phone">
            <div className="ap-glow" aria-hidden="true" />
            <Phone className="apph-hero"><div className="ap-hero-screen"><HomeScreen /></div></Phone>
            <span className="ap-chip c1"><Ico n="attendance" /> Attendance <b>75%</b></span>
            <span className="ap-chip c2"><Ico n="homework" /> Homework due <b>tomorrow</b></span>
            <span className="ap-chip c3"><Ico n="bell" /> New notice</span>
          </div>
        </div>
        <a className="ap-cue" href="#how" onClick={(e) => { e.preventDefault(); document.getElementById("how")?.scrollIntoView({ behavior: "smooth" }); }} aria-label="Scroll down"><i /></a>
      </header>

      {/* ═════════ MARQUEE ═════════ */}
      <div className="ap-marq" aria-hidden="true">
        <div className="ap-marq-track">
          {[0, 1].map((k) => <span key={k}>{["Timetable", "Homework", "Projects", "Attendance", "Results", "Marksheets", "Notices", "Events", "Offline mode"].map((w) => <em key={w}>{w}</em>)}</span>)}
        </div>
      </div>

      {/* ═════════ PINNED SCROLL STORY ═════════ */}
      <section className="ap-story" id="how" ref={story} aria-label="What the app looks like">
        <div className="ap-stage">
          <div className="ap-aurora soft" aria-hidden="true"><i /><i /></div>
          <div className="wrap ap-story-grid">
            <div className="ap-story-phone">
              <div className="ap-ring" aria-hidden="true"><i /></div>
              <Phone className="apph-story">
                {CHAPTERS.map((c, i) => (
                  <div key={c.tag} className={`ap-sc${i === 1 ? " is-default" : ""}`} ref={(el) => { screens.current[i] = el; }} style={{ "--o": i === 0 ? 1 : 0 } as CSSProperties}>{c.screen}</div>
                ))}
              </Phone>
            </div>
            <div className="ap-story-text">
              <ol className="ap-dots" aria-hidden="true">{CHAPTERS.map((c, i) => <li key={c.tag} className={i === active ? "on" : i < active ? "done" : ""} />)}</ol>
              <div className="ap-chapters">
                {CHAPTERS.map((c, i) => (
                  <article key={c.tag} className="ap-ch" ref={(el) => { chapters.current[i] = el; }} style={{ "--o": i === 0 ? 1 : 0 } as CSSProperties} aria-current={i === active}>
                    <span className="ap-eyebrow sm">{String(i + 1).padStart(2, "0")} · {c.tag}</span>
                    <h2>{c.title}</h2>
                    <p>{c.text}</p>
                  </article>
                ))}
              </div>
              <p className="ap-sample">Screens show sample data.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═════════ FEATURES ═════════ */}
      <section className="ap-sec">
        <div className="wrap">
          <div className="ap-head" data-reveal>
            <span className="ap-eyebrow sm">Everything in one place</span>
            <h2>Built for the school day.</h2>
            <p>Everything you check ten times a day, in one app.</p>
          </div>
          <div className="ap-feats">
            {FEATURES.map((f, i) => (
              <article key={f.t} className="ap-feat" data-reveal="zoom" style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
                <span className="ap-feat-ico"><Ico n={f.i} /></span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════ DOWNLOAD ═════════ */}
      <section className="ap-sec ap-dl" id="download">
        <div className="ap-aurora soft" aria-hidden="true"><i /><i /></div>
        <div className="wrap">
          <div className="ap-head" data-reveal>
            <span className="ap-eyebrow sm">Download</span>
            <h2>Get the app in under a minute.</h2>
            <p>Free. Three steps. No store account needed.</p>
          </div>

          {data === null ? (
            <SkRowCards count={1} variant="file" />
          ) : apps.length === 0 ? (
            <EmptyPanel icon="file" title={error ? "Downloads could not be loaded" : "The app file is coming soon"}>{error ?? "When the school publishes the app it will appear here. Until then, add the website to your home screen below."}</EmptyPanel>
          ) : (
            <div className="ap-dl-grid">
              {apps.map((a, i) => (
                <article key={a.id} className={`ap-dl-card${i === 0 && a.platform === mine ? " is-match" : ""}`} data-reveal="zoom">
                  <header>
                    <span className="ap-dl-ico"><Ico n={a.platform === "ANDROID" || a.platform === "IOS" ? "phone" : a.platform === "WEB" ? "share" : "download"} /></span>
                    <div><h3>{a.name}</h3><span>{a.platform_label}</span></div>
                    {i === 0 && a.platform === mine && <em className="ap-badge">For your device</em>}
                  </header>
                  {(a.version || a.size_text) && <div className="ap-meta">{a.version && <span>Version {versionText(a.version)}</span>}{a.size_text && <span>{sizeText(a.size_text)}</span>}</div>}
                  {a.notes && <p className="ap-notes">{a.notes}</p>}
                  <a className="ap-cta wide" href={href(a)} target="_blank" rel="noopener noreferrer">
                    <span className="ap-cta-ico"><Ico n="download" /></span>
                    <span className="ap-cta-txt"><b>{a.platform === "WEB" ? "Open" : "Download"}</b><small>{a.platform_label}</small></span>
                  </a>
                  {a.download_url && <a className="ap-link" href={a.download_link} target="_blank" rel="noopener noreferrer">Open the file page instead</a>}
                </article>
              ))}
            </div>
          )}

          <ol className="ap-steps" ref={steps} aria-label="How to install">
            <li className="ap-steps-line" aria-hidden="true"><i /></li>
            {STEPS.map((s, i) => (
              <li key={s.t} className="ap-step" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="ap-step-n">{i + 1}</span>
                <span className="ap-step-ico"><Ico n={s.i} /></span>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>

          <div className="ap-pwa" data-reveal>
            <span className="ap-pwa-ico"><Ico n="phone" /></span>
            <div className="ap-pwa-txt">
              <h3>No download? Add the website to your home screen.</h3>
              {installed ? (
                <p className="ap-ok"><Ico n="check" /> You are already using the app.</p>
              ) : prompt ? (
                <p>It opens full-screen with its own icon — just like an app.</p>
              ) : device === "ios" ? (
                <p>In Safari tap <b>Share</b>, then <b>Add to Home Screen</b>, then <b>Add</b>.</p>
              ) : (
                <p>In Chrome tap the <b>⋮ menu</b>, then <b>Install app</b> (or <b>Add to Home screen</b>).</p>
              )}
            </div>
            {!installed && prompt && <button type="button" className="ap-ghost solid" onClick={() => void install()}>Install app</button>}
          </div>

          <p className="ap-safe"><Ico n="shield" /> <span>Only download the school app from this page. Android may ask you to allow installs from your browser — allow it just for this app.</span></p>
        </div>
      </section>

      {/* ═════════ FAQ ═════════ */}
      <section className="ap-sec">
        <div className="wrap ap-faq-wrap">
          <div className="ap-head left" data-reveal>
            <span className="ap-eyebrow sm">Questions</span>
            <h2>Good to know.</h2>
          </div>
          <div className="ap-faq">
            {FAQ.map((f, i) => (
              <details key={f.q} data-reveal style={{ transitionDelay: `${i * 60}ms` }}>
                <summary>{f.q}<Ico n="plus" className="ic ap-plus" /></summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
