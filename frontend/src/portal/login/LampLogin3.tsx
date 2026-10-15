import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SchoolLogo } from "../../components/SchoolLogo";
import { SITE } from "../../config/site";
import { loginCopy, useLoginForm } from "./useLoginForm";
import type { LoginViewProps } from "./types";
import "./LampLogin3.css";

/**
 * "Neumorphic lamp" login. Pull the cord (a soft verlet chain), the head tilts on a damped
 * spring, a warm light fills the room and the card appears. The physics, light, dust and
 *  are a port of lamp-login-neumorphic.html; the form is wired to the real
 * backend through useLoginForm. There is deliberately NO "Create account" tab: accounts are
 * created only by the school, and nothing here decides who may sign in — the backend does.
 */

interface P { x: number; y: number }
interface Drag { ox: number; oy: number; sx: number; sy: number; ext: number; moved: number; tx?: number; ty?: number }

export default function LampLogin3({ portal, initialNotice, onSigningIn, onSuccess }: LoginViewProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const boostRef = useRef<() => void>(() => {});
  const [showPass, setShowPass] = useState(false);
  const [caps, setCaps] = useState(false);

  const copy = loginCopy(portal);
  const f = useLoginForm({ portal, initialNotice, onSigningIn, onSuccess, formRef, idRef, passRef });

  useEffect(() => {
    if (f.phase === "ok") boostRef.current();
  }, [f.phase]);

  /* ───────── physics, light, (ported) ───────── */
  useEffect(() => {
    const root = document.documentElement;
    const scene = sceneRef.current!, wrap = wrapRef.current!, grab = grabRef.current!, card = cardRef.current!, head = headRef.current!, cv = cvRef.current!;
    const cx = cv.getContext("2d")!;
    card.inert = true; // hidden until the lamp is on, so keyboard users can't tab into it
    const still = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const N = 10, DT = 1 / 120, MAXPULL = 70;
    let on = false, T = 0, Ie = 0, tOn = 9, boost = 0, raf = 0, last = 0, acc = 0, dpr = 1, k = 1, ox = 0, oy = 0, HX = 0, HY = 0, REST = 138, hth = 0, hw = 0, tm = 0;
    let cord = "#a3a3ad";
    let sr = scene.getBoundingClientRect();
    let ac: AudioContext | undefined;
    let drag: Drag | null = null;
    let pts: P[] = [], prv: P[] = [], inv: number[] = [];
    let focusTimer = 0;
    const M = Array.from({ length: 52 }, () => ({ r: 40 + Math.random() * 640, f: Math.random() * 2 - 1, v: 0.05 + Math.random() * 0.12, p: Math.random() * 6, s: 0.8 + Math.random() * 1.4 }));
    const ST: [number, number[]][] = [[0, [201, 205, 219]], [0.12, [255, 86, 28]], [0.45, [255, 158, 48]], [0.8, [255, 214, 108]], [1, [255, 248, 224]]];
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const heat = (t: number) => { t = Math.min(1, t); for (let i = 1; i < 5; i++) if (t <= ST[i][0]) return mix(ST[i - 1][1], ST[i][1], (t - ST[i - 1][0]) / (ST[i][0] - ST[i - 1][0])); return ST[4][1]; };
    const readCord = () => getComputedStyle(scene).getPropertyValue("--cord").trim() || cord;


    /* geometry: scene coordinates of the lamp head hinge and cord anchor */
    const anchor = () => { const t = (hth * Math.PI) / 180, dx = 66 * k, dy = -6 * k; return { x: HX + dx * Math.cos(t) - dy * Math.sin(t), y: HY + dx * Math.sin(t) + dy * Math.cos(t) }; };
    function geom() {
      sr = scene.getBoundingClientRect(); const w = wrap.getBoundingClientRect();
      k = w.width / 360; ox = w.left - sr.left; oy = w.top - sr.top; HX = ox + 180 * k; HY = oy + 118 * k; REST = 138 * k;
      dpr = Math.min(devicePixelRatio || 1, 2); cv.width = sr.width * dpr; cv.height = sr.height * dpr;
      const a = anchor(), s = REST / (N - 1); pts = []; prv = []; inv = [];
      for (let i = 0; i < N; i++) { pts.push({ x: a.x, y: a.y + s * i }); prv.push({ x: a.x, y: a.y + s * i }); inv.push(i ? (i === N - 1 ? 0.4 : 1) : 0); }
      cord = readCord(); wake();
    }

    /* soft verlet cord: elastic links, light knob, gentle wind */
    function step() {
      const g = 1700 * DT * DT, s = REST / (N - 1), L = pts[N - 1], a = anchor();
      pts[0].x = a.x; pts[0].y = a.y;
      const wd = (Math.sin(tm * 0.9) * 26 + Math.sin(tm * 2.3) * 10) * DT * DT;
      for (let i = 1; i < N; i++) {
        if (drag && i === N - 1) continue;
        const p = pts[i], q = prv[i], vx = (p.x - q.x) * 0.993, vy = (p.y - q.y) * 0.993;
        q.x = p.x; q.y = p.y; p.x += vx + (wd * i) / N; p.y += vy + g;
      }
      if (drag && drag.tx != null) {
        let dx = drag.tx - a.x, dy = Math.max(drag.ty ?? 0, a.y + REST * 0.3) - a.y; const d = Math.hypot(dx, dy), m = REST + MAXPULL * k;
        if (d > m) { dx *= m / d; dy *= m / d; }
        prv[N - 1].x = L.x; prv[N - 1].y = L.y; L.x += (a.x + dx - L.x) * 0.22; L.y += (a.y + dy - L.y) * 0.22;
        drag.ext = Math.max(drag.ext, (Math.hypot(L.x - a.x, L.y - a.y) - REST) / k);
      }
      for (let it = 0; it < 10; it++) for (let i = 0; i < N - 1; i++) {
        const A = pts[i], B = pts[i + 1], ia = inv[i], ib = drag && i + 1 === N - 1 ? 0 : inv[i + 1];
        if (ia + ib === 0) continue;
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6, fc = (((d - s) / d) * (d > s ? 0.55 : 1)) / (ia + ib);
        A.x += dx * fc * ia; A.y += dy * fc * ia; B.x -= dx * fc * ib; B.y -= dy * fc * ib;
      }
    }
    const energy = () => { let e = 0; for (let i = 1; i < N; i++) e += Math.abs(pts[i].x - prv[i].x) + Math.abs(pts[i].y - prv[i].y); return e; };
    function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    function frame(t: number) {
      raf = 0; const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; tm += dt;
      acc += dt; while (acc >= DT) { step(); acc -= DT; }
      /* head tilts softly with the cord pull (damped spring, degrees) */
      const L = pts[N - 1], a = anchor(), pull = Math.max(0, (L.y - a.y) / k - 138), tgt = Math.max(-6, Math.min(6, ((L.x - a.x) / k) * 0.05)) + Math.min(4.5, pull * 0.06);
      hw += (-38 * (hth - tgt) - 5.2 * hw) * dt; hth += hw * dt;
      /* filament: heats fast, cools slowly; light ~ T^2; soft ignition flicker */
      tOn += dt; T += ((on ? 1 : 0) - T) * (1 - Math.exp(-dt / (on ? 0.2 : 0.6)));
      let fl = 1; if (on && tOn < 1) fl = 1 - 0.5 * Math.abs(Math.sin(tOn * 41 + Math.sin(tOn * 97) * 2)) * Math.exp(-tOn * 3.6);
      Ie = Math.min(1, T * T * fl); boost *= Math.exp(-dt * 2);
      draw();
      if (drag || on || boost > 0.01 || Math.abs((on ? 1 : 0) - T) > 0.002 || energy() > 0.04 || Math.abs(hw) > 0.02 || Math.abs(hth - tgt) > 0.02) wake();
    }
    function draw() {
      sr = scene.getBoundingClientRect();
      const L = pts[N - 1], P = pts[N - 2], an = -Math.atan2(L.x - P.x, L.y - P.y), th0 = (hth * Math.PI) / 180;
      const bx = HX - 12 * k * Math.sin(th0), by = HY + 12 * k * Math.cos(th0);
      head.setAttribute("transform", "rotate(" + hth.toFixed(3) + " 180 118)");
      grab.style.transform = "translate(" + (L.x - 24) + "px," + (L.y - 10) + "px) rotate(" + an + "rad)";
      const lightTheme = root.dataset.theme === "light";
      const bc = heat(T), wc = mix(bc, lightTheme ? [255, 255, 255] : [196, 184, 255], 0.72), st = scene.style;
      st.setProperty("--lx", bx.toFixed(1) + "px"); st.setProperty("--ly", by.toFixed(1) + "px");
      st.setProperty("--I", Ie.toFixed(3)); st.setProperty("--T", T.toFixed(3));
      st.setProperty("--cs", (128 + hth).toFixed(2) + "deg");
      st.setProperty("--bcr", bc.join(",")); st.setProperty("--wcr", wc.join(",")); st.setProperty("--br", (120 + 80 * boost).toFixed(0) + "px");
      if (on || Ie > 0.01) {
        const c = card.getBoundingClientRect(), cl = c.left - sr.left, ct = c.top - sr.top, cs = card.style, d = Math.hypot(cl + c.width / 2 - bx, ct - by);
        cs.setProperty("--cx", (bx - cl).toFixed(0) + "px"); cs.setProperty("--cy", (by - ct).toFixed(0) + "px");
        cs.setProperty("--ci", (Math.min(1, 1.6 / (1 + (d / 320) ** 2)) * Ie).toFixed(3));
      }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, sr.width, sr.height);
      cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = cord; cx.lineWidth = 2.3 * k; cx.shadowColor = "rgba(0,0,0,.35)"; cx.shadowBlur = 3; cx.shadowOffsetY = 1;
      cx.beginPath(); cx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < N - 1; i++) cx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
      cx.lineTo(L.x, L.y); cx.stroke(); cx.shadowColor = "transparent";
      if (Ie > 0.02 && !still) {
        const col = lightTheme ? "107,87,240" : "196,184,255";
        for (const m of M) {
          m.r += m.v; m.p += 0.012; if (m.r > 700) m.r = 40;
          const ang = th0 + m.f * 0.9, r = m.r * k, x = bx - Math.sin(ang) * r + Math.sin(m.p * 1.7) * 5 * k, y = by + Math.cos(ang) * r;
          const al = (Ie * (1 - m.f * m.f) * Math.min(1, m.r / 60) * 1.5) / (1 + (m.r / 260) ** 2) * (0.6 + 0.4 * Math.sin(m.p * 3)) * (lightTheme ? 0.9 : 1);
          cx.fillStyle = "rgba(" + col + "," + Math.min(0.9, al).toFixed(3) + ")"; cx.beginPath(); cx.arc(x, y, m.s * k, 0, 6.283); cx.fill();
        }
      }
    }

    function click() {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac = ac || new Ctx(); if (ac.state === "suspended") void ac.resume();
        const n = ac.sampleRate * 0.05, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
        const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = b; fl.type = "bandpass"; fl.frequency.value = 1600; g.gain.value = 0.55; s.connect(fl); fl.connect(g); g.connect(ac.destination); s.start();
      } catch { /* sound is a nicety */ }
    }
    function setLamp(state: boolean, kb: boolean, tug: boolean) {
      on = state; tOn = 0; scene.classList.toggle("on", on);
      grab.setAttribute("aria-checked", String(on)); grab.setAttribute("aria-label", "Lamp cord. Pull to turn the light " + (on ? "off" : "on"));
      card.inert = !on; card.setAttribute("aria-hidden", String(!on));
      click(); if (navigator.vibrate) navigator.vibrate(28);
      if (tug) { const L = pts[N - 1]; prv[N - 1].y = L.y - 3; prv[N - 1].x = L.x - (Math.random() - 0.5) * 1.2; }
      hw += on ? -6 : 6;
      if (on && kb) { window.clearTimeout(focusTimer); focusTimer = window.setTimeout(() => { if (on) idRef.current?.focus(); }, 1100); }
      if (!on && card.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      wake();
    }
    const onDown = (e: PointerEvent) => {
      grab.setPointerCapture(e.pointerId); sr = scene.getBoundingClientRect(); const L = pts[N - 1];
      drag = { ox: e.clientX - sr.left - L.x, oy: e.clientY - sr.top - L.y, sx: e.clientX, sy: e.clientY, ext: 0, moved: 0 }; wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      drag.tx = e.clientX - sr.left - drag.ox; drag.ty = e.clientY - sr.top - drag.oy;
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    };
    function release(cancel: boolean) {
      if (!drag) return; const d = drag; drag = null;
      if (!cancel) { if (d.ext > MAXPULL * 0.45) setLamp(!on, false, false); else if (d.moved < 6) setLamp(!on, false, true); }
      wake();
    }
    const onUp = () => release(false);
    const onCancel = () => release(true);
    const onGrabClick = (e: MouseEvent) => { if (e.detail === 0) setLamp(!on, true, true); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && on) setLamp(false, true, true); };
    grab.addEventListener("pointerdown", onDown);
    grab.addEventListener("pointermove", onMove);
    grab.addEventListener("pointerup", onUp);
    grab.addEventListener("pointercancel", onCancel);
    grab.addEventListener("click", onGrabClick);
    addEventListener("keydown", onEsc);
    const idle = still ? 0 : window.setInterval(() => { if (!on && !drag && !document.hidden) { prv[N - 1].x = pts[N - 1].x - 0.8; wake(); } }, 6500);
    const ro = new ResizeObserver(geom);
    ro.observe(scene);
    geom();
    boostRef.current = () => { boost = 1; wake(); };

    return () => {
      cancelAnimationFrame(raf); raf = 0;
      window.clearInterval(idle); window.clearTimeout(focusTimer);
      ro.disconnect();
      removeEventListener("keydown", onEsc);
      grab.removeEventListener("pointerdown", onDown); grab.removeEventListener("pointermove", onMove);
      grab.removeEventListener("pointerup", onUp); grab.removeEventListener("pointercancel", onCancel);
      grab.removeEventListener("click", onGrabClick);
      void ac?.close().catch(() => {});
      root.classList.remove("vt");
    };
  }, []);

  const busy = f.phase !== "idle";
  const subtitle = portal === "admin" ? "Head Sir sign-in. Use your administrator email." : "Sign in with the username given to you by the school.";

  return (
    <div className="nlp">
      <div className="scene" ref={sceneRef}>
        <div className="lay dim" /><div className="lay vig" /><div className="lay warm" /><div className="lay cone" />
        <canvas id="nlp-fx" ref={cvRef} aria-hidden="true" />
        <button className="grab" ref={grabRef} type="button" role="switch" aria-checked="false" aria-label="Lamp cord. Pull to turn the light on"><i className="bead" /></button>
        <div className="lay bloom" />
        <main className="content">
          <section className="lamp-side" aria-label="Lamp">
            <div className="lamp-wrap" ref={wrapRef}>
              <svg className="lamp" viewBox="0 0 360 470" aria-hidden="true">
                <defs>
                  <linearGradient id="nlp-sh" x1="0" x2="1"><stop offset="0" style={{ stopColor: "var(--sh1)" }} /><stop offset=".5" style={{ stopColor: "var(--sh2)" }} /><stop offset="1" style={{ stopColor: "var(--sh1)" }} /></linearGradient>
                  <linearGradient id="nlp-po" x1="0" x2="1"><stop offset="0" style={{ stopColor: "var(--p1)" }} /><stop offset=".5" style={{ stopColor: "var(--p2)" }} /><stop offset="1" style={{ stopColor: "var(--p1)" }} /></linearGradient>
                </defs>
                <ellipse cx="180" cy="453" rx="70" ry="10" fill="#000" opacity=".35" />
                <path d="M118 448h124c0-10-14-16-30-18h-64c-16 2-30 8-30 18z" fill="url(#nlp-po)" />
                <rect x="176" y="120" width="8" height="312" rx="4" fill="url(#nlp-po)" />
                <g ref={headRef}><circle className="bulb" cx="180" cy="124" r="15" /><path d="M104 118 L130 52 Q180 40 230 52 L256 118 Z" fill="url(#nlp-sh)" /><ellipse className="rim" cx="180" cy="118" rx="74" ry="4" /></g>
              </svg>
              <div className="hint">It's dark in here. Pull the cord to sign in.</div>
            </div>
          </section>

          <section className="card" ref={cardRef} aria-labelledby="nlp-ttl">
            <div className="brandrow">
              <SchoolLogo size={46} />
              <span>{SITE.name}</span>
            </div>
            <h1 id="nlp-ttl">Welcome back</h1>
            <p className="sub">{subtitle}</p>
            <form ref={formRef} onSubmit={f.onSubmit} noValidate>
              <div className={`field${f.errId ? " bad" : ""}`}>
                <input ref={idRef} id="nlp-id" type={copy.idType} autoComplete={copy.idAutoComplete} autoCapitalize="none" spellCheck={false} placeholder=" " value={f.identifier} onChange={(e) => f.setIdentifier(e.target.value)} aria-invalid={!!f.errId} />
                <label htmlFor="nlp-id">{copy.idLabel}</label>
                <small className="err">{f.errId}</small>
              </div>
              <div className={`field${f.errPass ? " bad" : ""}`}>
                <input
                  ref={passRef}
                  id="nlp-pass"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder=" "
                  value={f.password}
                  onChange={(e) => f.setPassword(e.target.value)}
                  onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
                  onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                  onBlur={() => setCaps(false)}
                  aria-invalid={!!f.errPass}
                />
                <label htmlFor="nlp-pass">Password</label>
                <button className="eye" type="button" aria-pressed={showPass} aria-label={showPass ? "Hide password" : "Show password"} onClick={() => setShowPass((v) => !v)}>
                  {showPass ? "Hide" : "Show"}
                </button>
                <small className="err">{f.errPass}</small>
              </div>
              {caps && <div className="caps">Caps Lock is on.</div>}
              <p className="help">Forgot your password? Ask the school office to reset it.</p>
              <button className={`cta${f.phase === "loading" ? " loading" : ""}${f.phase === "ok" ? " ok" : ""}`} type="submit" disabled={busy}>
                <span>{f.phase === "ok" ? "Signed in" : f.phase === "loading" ? "Signing in" : "Sign in"}</span>
              </button>
            </form>
            <div className="status" role="status" aria-live="polite" data-tone={f.status.tone}>{f.status.text}</div>
            <Link className="back" to="/">← Back to the school website</Link>
          </section>
        </main>
      </div>
    </div>
  );
}
