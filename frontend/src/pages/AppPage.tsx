import { useEffect, useMemo, useState } from "react";
import { EmptyPanel, PageHero, Section } from "../components/site/PageHero";
import { SkRowCards } from "../components/loading/Loading";
import { SITE } from "../config/site";
import { usePaged } from "../lib/usePaged";
import { usePageMeta } from "../lib/usePageMeta";
import type { AppPlatform, AppRelease } from "../types/api";
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

const ICON: Record<AppPlatform, string> = {
  ANDROID: "M7 18a1 1 0 0 0 1 1h1v3h2v-3h2v3h2v-3h1a1 1 0 0 0 1-1V9H7zM5 9v6M19 9v6M8 4l1.5 2M16 4l-1.5 2M7 9a5 5 0 0 1 10 0",
  IOS: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM11 18h2",
  WINDOWS: "M3 5l8-1v7H3zM13 4l8-1v8h-8zM3 13h8v7l-8-1zM13 13h8v8l-8-1z",
  MAC: "M4 5h16v11H4zM8 20h8M12 16v4",
  WEB: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z",
  OTHER: "M12 3v12M7 11l5 5 5-5M5 21h14",
};

function PlatformIcon({ platform }: { platform: AppPlatform }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON[platform] ?? ICON.OTHER} />
    </svg>
  );
}

export function AppPage() {
  usePageMeta("App", `Download the ${SITE.nameFull} app, or add the website to your phone's home screen.`);
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

  return (
    <>
      <PageHero crumb="App" eyebrow="Get the app" title="Take the school in your pocket." lede="Notices, timetable, homework, projects and results — one tap away on your phone. Download the app below, or add this website to your home screen." />
      <Section>
        <div className="app-grid">
          <div className="app-install" data-reveal>
            <h2>Add to your home screen</h2>
            {installed ? (
              <span className="app-ok">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                You are already using the app.
              </span>
            ) : prompt ? (
              <>
                <p>Install the school website as an app: it opens full-screen with its own icon, and needs no download from a store.</p>
                <div className="app-actions"><button type="button" className="btn btn-primary" onClick={() => void install()}>Install app</button></div>
              </>
            ) : device === "ios" ? (
              <>
                <p>On iPhone or iPad, use Safari:</p>
                <ol><li>Tap the <b>Share</b> button (the square with an arrow).</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. The school icon appears on your home screen.</li></ol>
              </>
            ) : (
              <>
                <p>Open this page in Chrome, then:</p>
                <ol><li>Tap the <b>⋮ menu</b> (top right).</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Tap <b>Install</b>. The school icon appears with your other apps.</li></ol>
              </>
            )}
          </div>

          {data === null ? (
            <SkRowCards count={2} variant="file" />
          ) : apps.length === 0 ? (
            <EmptyPanel icon="file" title={error ? "Downloads could not be loaded" : "App downloads are coming soon"}>{error ?? "When the school publishes an app file it will appear here. Until then you can add the website to your home screen above."}</EmptyPanel>
          ) : (
            <>
              <div className="app-cards">
                {apps.map((a) => (
                  <article className={`app-card${a.platform === mine ? " is-match" : ""}`} key={a.id} data-reveal>
                    <header>
                      <span className="app-ico"><PlatformIcon platform={a.platform} /></span>
                      <div>
                        <h3>{a.name}{a.platform === mine && <span className="app-badge">For your device</span>}</h3>
                        <span className="app-plat">{a.platform_label}</span>
                      </div>
                    </header>
                    {(a.version || a.size_text) && <div className="app-meta">{a.version && <span>Version {a.version}</span>}{a.size_text && <span>{a.size_text}</span>}</div>}
                    {a.notes && <p className="app-notes">{a.notes}</p>}
                    <div className="app-actions">
                      <a className="btn btn-primary btn-sm" href={a.download_url ?? a.download_link} target="_blank" rel="noopener noreferrer">{a.platform === "WEB" ? "Open" : "Download"}</a>
                      {a.download_url && <a className="btn btn-outline btn-sm" href={a.download_link} target="_blank" rel="noopener noreferrer">View page</a>}
                    </div>
                  </article>
                ))}
              </div>
              <p className="app-safe">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
                <span>Only download the school app from this page. On Android your phone may ask you to allow installs from your browser — allow it just for this app, then switch it off again.</span>
              </p>
            </>
          )}
        </div>
      </Section>
    </>
  );
}
