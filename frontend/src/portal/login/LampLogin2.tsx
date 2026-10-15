import { useEffect, useRef, useState } from "react";
import { loginCopy, useLoginForm } from "./useLoginForm";
import type { LoginViewProps } from "./types";
import "./LampLogin2.css";

/**
 * "Lamp — physics duo" login. Pull the cord (a soft verlet chain), the lamp
 * swings on a lagging spring, the room lights up and the card appears.
 * The cord physics, light, particles and  are a port of
 * lamp_login_physics_duo.html; the form is wired to the real backend through
 * useLoginForm (nothing here decides who may sign in).
 */
export default function LampLogin2({ portal, initialNotice, onSigningIn, onSuccess }: LoginViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const lampRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const offRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const boostRef = useRef<() => void>(() => {});
  const [showPass, setShowPass] = useState(false);
  const [caps, setCaps] = useState(false);
  const [note, setNote] = useState("");

  const copy = loginCopy(portal);
  const f = useLoginForm({ portal, initialNotice, onSigningIn, onSuccess, formRef, idRef, passRef });

  useEffect(() => {
    if (f.phase === "ok") boostRef.current();
  }, [f.phase]);

  /* ───────── physics, light, (ported) ───────── */
  useEffect(() => {
    const root = document.documentElement;
    const scene = sceneRef.current!, lamp = lampRef.current!, card = cardRef.current!, cv = cvRef.current!, rail = railRef.current!, offBtn = offRef.current!;
    card.inert = true; // hidden until the lamp is on, so keyboard users can't tab into it
    const cx = cv.getContext("2d")!;
    const still = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const N = 12, MAXPULL = 80, LB = 40, DT = 1 / 120;
    let on = false, T = 0, Ie = 0, tOn = 9, boost = 0, raf = 0, last = 0, acc = 0, dpr = 1, px = 0, py = 0, REST = 110, tm = 0, la = 0, lw = 0;
    let sr = scene.getBoundingClientRect();
    let ac: AudioContext | undefined;
    let drag: { ox: number; oy: number; sx: number; sy: number; ext: number; moved: number; tx?: number; ty?: number } | null = null;
    let pts: { x: number; y: number }[] = [], prv: { x: number; y: number }[] = [], inv: number[] = [];
    let focusTimer = 0;
    const M = Array.from({ length: 46 }, () => ({ r: 40 + Math.random() * 640, f: Math.random() * 2 - 1, v: 0.05 + Math.random() * 0.12, p: Math.random() * 6, s: 0.8 + Math.random() * 1.4 }));
    const ST: [number, number[]][] = [[0, [201, 205, 219]], [0.12, [255, 86, 28]], [0.45, [255, 158, 48]], [0.8, [255, 214, 108]], [1, [255, 248, 224]]];
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const heat = (t: number) => { t = Math.min(1, t); for (let i = 1; i < 5; i++) if (t <= ST[i][0]) return mix(ST[i - 1][1], ST[i][1], (t - ST[i - 1][0]) / (ST[i][0] - ST[i - 1][0])); return ST[4][1]; };


    /* soft verlet chain: elastic links, light wind, lamp swings on a lagging spring */
    function geom() {
      sr = scene.getBoundingClientRect(); const rl = rail.getBoundingClientRect();
      px = sr.width / 2; py = rl.bottom - sr.top - 2; REST = Math.max(84, Math.min(140, innerHeight * 0.13));
      dpr = Math.min(devicePixelRatio || 1, 2); cv.width = sr.width * dpr; cv.height = sr.height * dpr;
      const s = REST / (N - 1); pts = []; prv = []; inv = [];
      for (let i = 0; i < N; i++) { pts.push({ x: px, y: py + s * i }); prv.push({ x: px, y: py + s * i }); inv.push(i ? (i === N - 1 ? 0.16 : 1) : 0); }
      wake();
    }
    function step() {
      const g = 2100 * DT * DT, s = REST / (N - 1), L = pts[N - 1], wd = (Math.sin(tm * 0.8) * 24 + Math.sin(tm * 2.1) * 9) * DT * DT;
      for (let i = 1; i < N; i++) {
        if (drag && i === N - 1) continue;
        const p = pts[i], q = prv[i], vx = (p.x - q.x) * 0.993, vy = (p.y - q.y) * 0.993;
        q.x = p.x; q.y = p.y; p.x += vx + (wd * i) / N; p.y += vy + g;
      }
      if (drag && drag.tx != null) {
        let dx = drag.tx - px, dy = Math.max(drag.ty ?? 0, py + REST * 0.3) - py; const d = Math.hypot(dx, dy), m = REST + MAXPULL;
        if (d > m) { dx *= m / d; dy *= m / d; }
        prv[N - 1].x = L.x; prv[N - 1].y = L.y; L.x += (px + dx - L.x) * 0.24; L.y += (py + dy - L.y) * 0.24;
        drag.ext = Math.max(drag.ext, Math.hypot(L.x - px, L.y - py) - REST);
      }
      for (let it = 0; it < 10; it++) for (let i = 0; i < N - 1; i++) {
        const a = pts[i], b = pts[i + 1], ia = inv[i], ib = drag && i + 1 === N - 1 ? 0 : inv[i + 1];
        if (ia + ib === 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, fc = ((d - s) / d) * (d > s ? 0.6 : 1) / (ia + ib);
        a.x += dx * fc * ia; a.y += dy * fc * ia; b.x -= dx * fc * ib; b.y -= dy * fc * ib;
      }
    }
    const energy = () => { let e = 0; for (let i = 1; i < N; i++) e += Math.abs(pts[i].x - prv[i].x) + Math.abs(pts[i].y - prv[i].y); return e; };
    function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    function frame(t: number) {
      raf = 0; const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; tm += dt;
      acc += dt; while (acc >= DT) { step(); acc -= DT; }
      const L = pts[N - 1], P = pts[N - 2], ta = -Math.atan2(L.x - P.x, L.y - P.y);
      lw += (-46 * (la - ta) - 6.2 * lw) * dt; la += lw * dt;
      tOn += dt; T += ((on ? 1 : 0) - T) * (1 - Math.exp(-dt / (on ? 0.2 : 0.6)));
      let fl = 1; if (on && tOn < 1) fl = 1 - 0.5 * Math.abs(Math.sin(tOn * 41 + Math.sin(tOn * 97) * 2)) * Math.exp(-tOn * 3.6);
      Ie = Math.min(1, T * T * fl); boost *= Math.exp(-dt * 2);
      draw();
      if (drag || on || boost > 0.01 || Math.abs((on ? 1 : 0) - T) > 0.002 || energy() > 0.04 || Math.abs(lw) > 0.01 || Math.abs(la - ta) > 0.003) wake();
    }
    function draw() {
      sr = scene.getBoundingClientRect();
      const L = pts[N - 1], thA = la, bx = L.x - LB * Math.sin(thA), by = L.y + LB * Math.cos(thA);
      lamp.style.transform = `translate(${L.x - 44}px,${L.y}px) rotate(${thA}rad)`;
      const bc = heat(T), wc = mix(bc, [255, 200, 100], 0.55), st = scene.style;
      st.setProperty("--lx", bx.toFixed(1) + "px"); st.setProperty("--ly", by.toFixed(1) + "px");
      st.setProperty("--I", Ie.toFixed(3)); st.setProperty("--T", T.toFixed(3));
      st.setProperty("--cs", (128 + thA * 57.2958).toFixed(2) + "deg");
      st.setProperty("--bcr", bc.join(",")); st.setProperty("--wcr", wc.join(",")); st.setProperty("--br", (120 + 80 * boost).toFixed(0) + "px");
      if (on || Ie > 0.01) {
        const c = card.getBoundingClientRect(), cl = c.left - sr.left, ct = c.top - sr.top, dx = cl + c.width / 2 - bx, dy = ct + c.height / 2 - by, d = Math.hypot(dx, dy) || 1, cs = card.style;
        const sx = (dx / d) * 22 + 5, sy = (dy / d) * 22 + 3;
        cs.setProperty("--sx", sx.toFixed(1) + "px"); cs.setProperty("--sy", sy.toFixed(1) + "px");
        cs.setProperty("--ix", (sx * 0.28).toFixed(1) + "px"); cs.setProperty("--iy", (sy * 0.28).toFixed(1) + "px");
        cs.setProperty("--cx", (bx - cl).toFixed(0) + "px"); cs.setProperty("--cy", (by - ct).toFixed(0) + "px");
        cs.setProperty("--ci", (Math.min(1, 1.7 / (1 + (Math.hypot(cl + c.width / 2 - bx, ct - by) / 300) ** 2)) * Ie).toFixed(3));
      }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, sr.width, sr.height);
      cx.lineWidth = 1.2; cx.strokeStyle = "#a98137"; cx.beginPath();
      pts.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y))); cx.stroke();
      cx.shadowColor = "rgba(60,40,10,.45)"; cx.shadowBlur = 2.5; cx.shadowOffsetY = 1;
      for (let i = 0; i < N - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        for (const fr of [0, 0.5]) {
          const x = a.x + (b.x - a.x) * fr, y = a.y + (b.y - a.y) * fr;
          cx.fillStyle = "#c9a24d"; cx.beginPath(); cx.arc(x, y, 2.8, 0, 6.283); cx.fill();
          cx.fillStyle = "#f5e4a8"; cx.beginPath(); cx.arc(x - 0.7, y - 0.8, 1, 0, 6.283); cx.fill();
        }
      }
      cx.shadowColor = "transparent";
      if (Ie > 0.02 && !still) {
        const lt = root.dataset.theme === "light", col = lt ? "196,118,10" : "232,160,30";
        for (const m of M) {
          m.r += m.v; m.p += 0.012; if (m.r > 700) m.r = 40;
          const ang = thA + m.f * 0.9, x = bx - Math.sin(ang) * m.r + Math.sin(m.p * 1.7) * 5, y = by + Math.cos(ang) * m.r;
          const a = ((Ie * (1 - m.f * m.f) * Math.min(1, m.r / 60) * 1.5) / (1 + (m.r / 260) ** 2)) * (0.6 + 0.4 * Math.sin(m.p * 3)) * (lt ? 0.9 : 1);
          cx.fillStyle = `rgba(${col},${Math.min(0.9, a).toFixed(3)})`; cx.beginPath(); cx.arc(x, y, m.s, 0, 6.283); cx.fill();
        }
      }
    }

    function click() {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac = ac || new Ctor(); if (ac.state === "suspended") ac.resume();
        const n = ac.sampleRate * 0.05, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
        const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
        s.buffer = b; fl.type = "bandpass"; fl.frequency.value = 1600; g.gain.value = 0.55; s.connect(fl); fl.connect(g); g.connect(ac.destination); s.start();
      } catch { /* audio is optional */ }
    }
    function setLamp(state: boolean, kb: boolean, tug: boolean) {
      on = state; tOn = 0; scene.classList.toggle("on", on);
      lamp.setAttribute("aria-checked", String(on)); lamp.setAttribute("aria-label", `Lamp. Pull down to turn the light ${on ? "off" : "on"}`);
      card.inert = !on; card.setAttribute("aria-hidden", String(!on));
      click(); if (navigator.vibrate) navigator.vibrate(28);
      if (tug) { const L = pts[N - 1]; prv[N - 1].y = L.y - 3; prv[N - 1].x = L.x - (Math.random() - 0.5) * 1.2; }
      if (on && kb) { window.clearTimeout(focusTimer); focusTimer = window.setTimeout(() => { if (on) idRef.current?.focus(); }, 1100); }
      if (!on && card.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      wake();
    }
    const onDown = (e: PointerEvent) => {
      lamp.setPointerCapture(e.pointerId); sr = scene.getBoundingClientRect(); const L = pts[N - 1];
      drag = { ox: e.clientX - sr.left - L.x, oy: e.clientY - sr.top - L.y, sx: e.clientX, sy: e.clientY, ext: 0, moved: 0 }; wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      drag.tx = e.clientX - sr.left - drag.ox; drag.ty = e.clientY - sr.top - drag.oy;
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    };
    const release = (cancel: boolean) => {
      if (!drag) return; const d = drag; drag = null;
      if (!cancel) { if (d.ext > MAXPULL * 0.45) setLamp(!on, false, false); else if (d.moved < 6) setLamp(!on, false, true); }
      wake();
    };
    const onUp = () => release(false), onCancel = () => release(true);
    const onClick = (e: MouseEvent) => { if (e.detail === 0) setLamp(!on, true, true); };
    const onOff = () => setLamp(false, false, true);
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape" && on) setLamp(false, true, true); };
    lamp.addEventListener("pointerdown", onDown); lamp.addEventListener("pointermove", onMove);
    lamp.addEventListener("pointerup", onUp); lamp.addEventListener("pointercancel", onCancel); lamp.addEventListener("click", onClick);
    offBtn.addEventListener("click", onOff); addEventListener("keydown", onEsc);
    const idle = still ? 0 : window.setInterval(() => { if (!on && !drag && !document.hidden) { prv[N - 1].x = pts[N - 1].x - 0.8; wake(); } }, 6500);
    const ro = new ResizeObserver(geom); ro.observe(scene); geom();
    boostRef.current = () => { boost = 1; wake(); };

    return () => {
      cancelAnimationFrame(raf); window.clearInterval(idle); window.clearTimeout(focusTimer); ro.disconnect();
      removeEventListener("keydown", onEsc);
      lamp.removeEventListener("pointerdown", onDown); lamp.removeEventListener("pointermove", onMove);
      lamp.removeEventListener("pointerup", onUp); lamp.removeEventListener("pointercancel", onCancel); lamp.removeEventListener("click", onClick);
      offBtn.removeEventListener("click", onOff); ac?.close().catch(() => {}); root.classList.remove("vt");
    };
  }, []);

  const capsOn = (e: React.KeyboardEvent) => setCaps(!!e.getModifierState?.("CapsLock"));
  const loading = f.phase === "loading", ok = f.phase === "ok";
  const IdIcon = portal === "admin"
    ? (<><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M4 7l8 6 8-6" /></>)
    : (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>);

  return (
    <div className="lp2" ref={rootRef}>
      <div className="scene" ref={sceneRef}>
        <div className="lay dim" /><div className="lay vig" /><div className="lay warm" /><div className="lay cone" />
        <canvas id="fx" ref={cvRef} aria-hidden="true" />
        <div className="rail" ref={railRef} />
        <button className="lamp" ref={lampRef} type="button" role="switch" aria-checked="false" aria-label="Lamp. Pull down to turn the light on"><i className="bulb" /></button>
        <div className="lay bloom" />
        <main className="stage">
          <div className="zone"><div className="hint">Pull the lamp to login</div></div>
          <section className="card" ref={cardRef} aria-hidden="true" aria-labelledby="lp2-ttl">
            <div className="head rv" style={{ ["--i" as string]: 0 }}><h1 id="lp2-ttl">Welcome Back</h1><span className="live"><i />SECURE</span></div>
            <p className="sub rv" style={{ ["--i" as string]: 1 }}>{portal === "admin" ? "Super Admin sign in." : "Student & staff sign in."}</p>
            <form ref={formRef} onSubmit={f.onSubmit} noValidate>
              <div className={`nf rv ${f.errId ? "bad" : ""}`} style={{ ["--i" as string]: 2 }}>
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">{IdIcon}</svg>
                <input ref={idRef} type={copy.idType} autoComplete={copy.idAutoComplete} placeholder={copy.idLabel} aria-label={copy.idLabel} aria-invalid={!!f.errId} value={f.identifier} onChange={(e) => f.setIdentifier(e.target.value)} autoCapitalize="none" spellCheck={false} />
                <small className="err">{f.errId}</small>
              </div>
              <div className={`nf rv ${f.errPass ? "bad" : ""}`} style={{ ["--i" as string]: 3 }}>
                <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
                <input ref={passRef} type={showPass ? "text" : "password"} autoComplete="current-password" placeholder="Password" aria-label="Password" aria-invalid={!!f.errPass} value={f.password} onChange={(e) => f.setPassword(e.target.value)} onKeyDown={capsOn} onKeyUp={capsOn} onBlur={() => setCaps(false)} />
                <button className="eye" type="button" aria-pressed={showPass} aria-label={showPass ? "Hide password" : "Show password"} onClick={() => setShowPass((s) => !s)}>
                  <svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path className="sl" d="M4 4l16 16" /></svg>
                </button>
                <small className="err">{f.errPass}</small>
              </div>
              {caps && <div className="caps">Caps Lock is on.</div>}
              <button className={`go rv ${loading ? "loading" : ""} ${ok ? "ok" : ""}`} style={{ ["--i" as string]: 4 }} type="submit" disabled={loading || ok}>
                <span>{ok ? "WELCOME" : "LOGIN"}</span> <span>{ok ? "✓" : "→"}</span>
              </button>
            </form>
            <div className="rv" style={{ ["--i" as string]: 5 }}>
              <a className="forgot" href="#forgot" onClick={(e) => { e.preventDefault(); setNote("To reset a password, please contact the school office."); }}>Forgot password?</a>
            </div>
            <div className="msg" role="status" aria-live="polite" style={{ color: f.status.tone === "bad" ? "var(--bad)" : f.status.tone === "ok" ? "var(--ok)" : note ? "var(--amber)" : undefined }}>{f.status.text || note}</div>
            <button className="off rv" ref={offRef} type="button" style={{ ["--i" as string]: 6 }}>
              — PULL AGAIN TO TURN OFF —
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6" /></svg>
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
