import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../lib/theme";
import { loginCopy, useLoginForm } from "./useLoginForm";
import type { LoginViewProps } from "./types";
import "./LampLogin.css";

/**
 * "Lamp" login — pull the cord, the light comes on, the card appears. The
 * cord physics, light and theme reveal are a straight port of
 * lamp-login-neumorphic.html; only the form is wired to the real backend.
 */
export default function LampLogin({ portal, initialNotice, onSigningIn, onSuccess }: LoginViewProps) {
  const { resolved, setPreference } = useTheme();
  const boxRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const grabRefEl = useRef<HTMLButtonElement>(null);
  const themeBtn = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const boostRef = useRef<() => void>(() => {});
  const repaintRef = useRef<() => void>(() => {});
  const [lit, setLit] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [caps, setCaps] = useState(false);

  const copy = loginCopy(portal);
  const f = useLoginForm({ portal, initialNotice, onSigningIn, onSuccess, formRef, idRef, passRef });

  useEffect(() => {
    if (f.phase === "ok") boostRef.current();
  }, [f.phase]);

  useEffect(() => {
    repaintRef.current();
  }, [resolved]);

  useEffect(() => {
    const root = document.documentElement;
    const box = boxRef.current!;
    const scene = sceneRef.current!;
    const wrap = wrapRef.current!;
    const grab = grabRefEl.current!;
    const card = cardRef.current!;
    const head = headRef.current!;
    const cv = cvRef.current!;
    const cx = cv.getContext("2d")!;
    const still = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const N = 10,
      DT = 1 / 120,
      MAXPULL = 70;
    let on = false,
      T = 0,
      Ie = 0,
      tOn = 9,
      boost = 0,
      raf = 0,
      last = 0,
      acc = 0,
      dpr = 1,
      k = 1,
      ox = 0,
      oy = 0,
      HX = 0,
      HY = 0,
      REST = 138,
      hth = 0,
      hw = 0,
      tm = 0,
      stopped = false;
    void ox;
    void oy;
    let sr = scene.getBoundingClientRect();
    let ac: AudioContext | undefined;
    let cord = "#a3a3ad";
    interface Drag {
      ox: number;
      oy: number;
      sx: number;
      sy: number;
      ext: number;
      moved: number;
      tx?: number;
      ty?: number;
    }
    let drag: Drag | null = null;
    interface P {
      x: number;
      y: number;
    }
    let pts: P[] = [],
      prv: P[] = [],
      inv: number[] = [];
    const M = Array.from({ length: 52 }, () => ({ r: 40 + Math.random() * 640, f: Math.random() * 2 - 1, v: 0.05 + Math.random() * 0.12, p: Math.random() * 6, s: 0.8 + Math.random() * 1.4 }));
    const ST: Array<[number, number[]]> = [
      [0, [201, 205, 219]],
      [0.12, [255, 86, 28]],
      [0.45, [255, 158, 48]],
      [0.8, [255, 214, 108]],
      [1, [255, 248, 224]],
    ];
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    function heat(t: number) {
      t = Math.min(1, t);
      for (let i = 1; i < 5; i++) if (t <= ST[i][0]) return mix(ST[i - 1][1], ST[i][1], (t - ST[i - 1][0]) / (ST[i][0] - ST[i - 1][0]));
      return ST[4][1];
    }
    const readCord = () => {
      cord = getComputedStyle(box).getPropertyValue("--cord").trim();
    };

    /* geometry: scene coordinates of the lamp head hinge and cord anchor */
    function anchor() {
      const t = (hth * Math.PI) / 180,
        dx = 66 * k,
        dy = -6 * k;
      return { x: HX + dx * Math.cos(t) - dy * Math.sin(t), y: HY + dx * Math.sin(t) + dy * Math.cos(t) };
    }
    function geom() {
      sr = scene.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      k = w.width / 360;
      ox = w.left - sr.left;
      oy = w.top - sr.top;
      HX = ox + 180 * k;
      HY = oy + 118 * k;
      REST = 138 * k;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = sr.width * dpr;
      cv.height = sr.height * dpr;
      const a = anchor(),
        s = REST / (N - 1);
      pts = [];
      prv = [];
      inv = [];
      for (let i = 0; i < N; i++) {
        pts.push({ x: a.x, y: a.y + s * i });
        prv.push({ x: a.x, y: a.y + s * i });
        inv.push(i ? (i === N - 1 ? 0.4 : 1) : 0);
      }
      readCord();
      wake();
    }

    /* soft verlet cord: elastic links, light knob, gentle wind */
    function step() {
      const g = 1700 * DT * DT,
        s = REST / (N - 1),
        L = pts[N - 1],
        a = anchor();
      pts[0].x = a.x;
      pts[0].y = a.y;
      const wd = (Math.sin(tm * 0.9) * 26 + Math.sin(tm * 2.3) * 10) * DT * DT;
      for (let i = 1; i < N; i++) {
        if (drag && i === N - 1) continue;
        const p = pts[i],
          q = prv[i],
          vx = (p.x - q.x) * 0.993,
          vy = (p.y - q.y) * 0.993;
        q.x = p.x;
        q.y = p.y;
        p.x += vx + (wd * i) / N;
        p.y += vy + g;
      }
      if (drag && drag.tx != null && drag.ty != null) {
        let dx = drag.tx - a.x,
          dy = Math.max(drag.ty, a.y + REST * 0.3) - a.y;
        const d = Math.hypot(dx, dy),
          m = REST + MAXPULL * k;
        if (d > m) {
          dx *= m / d;
          dy *= m / d;
        }
        prv[N - 1].x = L.x;
        prv[N - 1].y = L.y;
        L.x += (a.x + dx - L.x) * 0.22;
        L.y += (a.y + dy - L.y) * 0.22;
        drag.ext = Math.max(drag.ext, (Math.hypot(L.x - a.x, L.y - a.y) - REST) / k);
      }
      for (let it = 0; it < 10; it++)
        for (let i = 0; i < N - 1; i++) {
          const A = pts[i],
            B = pts[i + 1],
            ia = inv[i],
            ib = drag && i + 1 === N - 1 ? 0 : inv[i + 1];
          if (ia + ib === 0) continue;
          const dx = B.x - A.x,
            dy = B.y - A.y,
            d = Math.hypot(dx, dy) || 1e-6,
            ff = (((d - s) / d) * (d > s ? 0.55 : 1)) / (ia + ib);
          A.x += dx * ff * ia;
          A.y += dy * ff * ia;
          B.x -= dx * ff * ib;
          B.y -= dy * ff * ib;
        }
    }
    const energy = () => {
      let e = 0;
      for (let i = 1; i < N; i++) e += Math.abs(pts[i].x - prv[i].x) + Math.abs(pts[i].y - prv[i].y);
      return e;
    };
    function wake() {
      if (!raf && !stopped) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    function frame(t: number) {
      raf = 0;
      if (stopped) return;
      const dt = Math.min(0.05, (t - last) / 1000 || 0);
      last = t;
      tm += dt;
      acc += dt;
      while (acc >= DT) {
        step();
        acc -= DT;
      }
      /* head tilts softly with the cord pull (damped spring, degrees) */
      const L = pts[N - 1],
        a = anchor(),
        pull = Math.max(0, (L.y - a.y) / k - 138),
        tgt = Math.max(-6, Math.min(6, ((L.x - a.x) / k) * 0.05)) + Math.min(4.5, pull * 0.06);
      hw += (-38 * (hth - tgt) - 5.2 * hw) * dt;
      hth += hw * dt;
      /* filament: heats fast, cools slowly; light ~ T^2; soft ignition flicker */
      tOn += dt;
      T += ((on ? 1 : 0) - T) * (1 - Math.exp(-dt / (on ? 0.2 : 0.6)));
      let fl = 1;
      if (on && tOn < 1) fl = 1 - 0.5 * Math.abs(Math.sin(tOn * 41 + Math.sin(tOn * 97) * 2)) * Math.exp(-tOn * 3.6);
      Ie = Math.min(1, T * T * fl);
      boost *= Math.exp(-dt * 2);
      draw();
      if (drag || on || boost > 0.01 || Math.abs((on ? 1 : 0) - T) > 0.002 || energy() > 0.04 || Math.abs(hw) > 0.02 || Math.abs(hth - tgt) > 0.02) wake();
    }
    function draw() {
      sr = scene.getBoundingClientRect();
      const L = pts[N - 1],
        P = pts[N - 2],
        an = -Math.atan2(L.x - P.x, L.y - P.y),
        th = (hth * Math.PI) / 180;
      const bx = HX - 12 * k * Math.sin(th),
        by = HY + 12 * k * Math.cos(th);
      head.setAttribute("transform", "rotate(" + hth.toFixed(3) + " 180 118)");
      grab.style.transform = "translate(" + (L.x - 24) + "px," + (L.y - 10) + "px) rotate(" + an + "rad)";
      const bc = heat(T),
        wc = mix(bc, root.dataset.theme === "light" ? [255, 255, 255] : [196, 184, 255], 0.72),
        st = scene.style;
      st.setProperty("--lx", bx.toFixed(1) + "px");
      st.setProperty("--ly", by.toFixed(1) + "px");
      st.setProperty("--I", Ie.toFixed(3));
      st.setProperty("--T", T.toFixed(3));
      st.setProperty("--cs", (128 + hth).toFixed(2) + "deg");
      st.setProperty("--bcr", bc.join(","));
      st.setProperty("--wcr", wc.join(","));
      st.setProperty("--br", (120 + 80 * boost).toFixed(0) + "px");
      if (on || Ie > 0.01) {
        const c = card.getBoundingClientRect(),
          cl = c.left - sr.left,
          ct = c.top - sr.top,
          cs = card.style,
          d = Math.hypot(cl + c.width / 2 - bx, ct - by);
        cs.setProperty("--cx", (bx - cl).toFixed(0) + "px");
        cs.setProperty("--cy", (by - ct).toFixed(0) + "px");
        cs.setProperty("--ci", (Math.min(1, 1.6 / (1 + (d / 320) ** 2)) * Ie).toFixed(3));
      }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, sr.width, sr.height);
      cx.lineCap = "round";
      cx.lineJoin = "round";
      cx.strokeStyle = cord;
      cx.lineWidth = 2.3 * k;
      cx.shadowColor = "rgba(0,0,0,.35)";
      cx.shadowBlur = 3;
      cx.shadowOffsetY = 1;
      cx.beginPath();
      cx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < N - 1; i++) cx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
      cx.lineTo(L.x, L.y);
      cx.stroke();
      cx.shadowColor = "transparent";
      if (Ie > 0.02 && !still) {
        const lightT = root.dataset.theme === "light",
          col = lightT ? "107,87,240" : "196,184,255";
        for (const m of M) {
          m.r += m.v;
          m.p += 0.012;
          if (m.r > 700) m.r = 40;
          const ang = th + m.f * 0.9,
            r = m.r * k,
            x = bx - Math.sin(ang) * r + Math.sin(m.p * 1.7) * 5 * k,
            y = by + Math.cos(ang) * r;
          const al = ((Ie * (1 - m.f * m.f) * Math.min(1, m.r / 60) * 1.5) / (1 + (m.r / 260) ** 2)) * (0.6 + 0.4 * Math.sin(m.p * 3)) * (lightT ? 0.9 : 1);
          cx.fillStyle = "rgba(" + col + "," + Math.min(0.9, al).toFixed(3) + ")";
          cx.beginPath();
          cx.arc(x, y, m.s * k, 0, 6.283);
          cx.fill();
        }
      }
    }

    function click() {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac = ac || new Ctor();
        if (ac.state === "suspended") void ac.resume();
        const n = ac.sampleRate * 0.05,
          b = ac.createBuffer(1, n, ac.sampleRate),
          d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
        const s = ac.createBufferSource(),
          fl = ac.createBiquadFilter(),
          g = ac.createGain();
        s.buffer = b;
        fl.type = "bandpass";
        fl.frequency.value = 1600;
        g.gain.value = 0.55;
        s.connect(fl);
        fl.connect(g);
        g.connect(ac.destination);
        s.start();
      } catch {
        /* audio is optional */
      }
    }
    function setLamp(state: boolean, kb: boolean, tug: boolean) {
      on = state;
      tOn = 0;
      setLit(on);
      grab.setAttribute("aria-checked", String(on));
      grab.setAttribute("aria-label", "Lamp cord. Pull to turn the light " + (on ? "off" : "on"));
      click();
      if (navigator.vibrate) navigator.vibrate(28);
      if (tug) {
        const L = pts[N - 1];
        prv[N - 1].y = L.y - 3;
        prv[N - 1].x = L.x - (Math.random() - 0.5) * 1.2;
      }
      hw += on ? -6 : 6;
      if (on && kb)
        window.setTimeout(() => {
          if (on) idRef.current?.focus();
        }, 1100);
      if (!on && card.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      wake();
    }
    const onDown = (e: PointerEvent) => {
      grab.setPointerCapture(e.pointerId);
      sr = scene.getBoundingClientRect();
      const L = pts[N - 1];
      drag = { ox: e.clientX - sr.left - L.x, oy: e.clientY - sr.top - L.y, sx: e.clientX, sy: e.clientY, ext: 0, moved: 0 };
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      drag.tx = e.clientX - sr.left - drag.ox;
      drag.ty = e.clientY - sr.top - drag.oy;
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    };
    function release(cancel: boolean) {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (!cancel) {
        if (d.ext > MAXPULL * 0.45) setLamp(!on, false, false);
        else if (d.moved < 6) setLamp(!on, false, true);
      }
      wake();
    }
    const onUp = () => release(false);
    const onCancel = () => release(true);
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) setLamp(!on, true, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && on) setLamp(false, true, true);
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if ((e.key === "t" || e.key === "T") && !e.ctrlKey && !e.metaKey && !/input|textarea/.test(tag)) themeBtn.current?.click();
    };
    grab.addEventListener("pointerdown", onDown);
    grab.addEventListener("pointermove", onMove);
    grab.addEventListener("pointerup", onUp);
    grab.addEventListener("pointercancel", onCancel);
    grab.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    const idle = still
      ? 0
      : window.setInterval(() => {
          if (!on && !drag && !document.hidden) {
            prv[N - 1].x = pts[N - 1].x - 0.8;
            wake();
          }
        }, 6500);
    const ro = new ResizeObserver(geom);
    ro.observe(scene);

    boostRef.current = () => {
      boost = 1;
      wake();
    };
    repaintRef.current = () => {
      readCord();
      wake();
    };
    geom();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearInterval(idle);
      ro.disconnect();
      grab.removeEventListener("pointerdown", onDown);
      grab.removeEventListener("pointermove", onMove);
      grab.removeEventListener("pointerup", onUp);
      grab.removeEventListener("pointercancel", onCancel);
      grab.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      void ac?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* theme: circular reveal from the toggle (View Transitions), instant fallback */
  const toggleTheme = () => {
    const t = resolved === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme = t; // synchronous, so the transition's "after" snapshot is already themed
      setPreference(t);
      repaintRef.current();
    };
    const still = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const btn = themeBtn.current;
    if (!document.startViewTransition || still || !btn) {
      apply();
      return;
    }
    const r = btn.getBoundingClientRect(),
      x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    const rad = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.classList.add("vt");
    const vt = document.startViewTransition(apply);
    void vt.ready
      .then(() =>
        root.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + rad + "px at " + x + "px " + y + "px)"] },
          { duration: 1000, easing: "cubic-bezier(.65,0,.2,1)", pseudoElement: "::view-transition-new(root)" }
        )
      )
      .catch(() => {});
    void vt.finished.finally(() => root.classList.remove("vt"));
  };

  const ctaLabel = f.phase === "ok" ? "Signed in" : "Sign in";

  return (
    <div className="lg-lamp" ref={boxRef}>
      <div className={`scene${lit ? " on" : ""}`} ref={sceneRef}>
        <div className="lay dim" />
        <div className="lay vig" />
        <div className="lay warm" />
        <div className="lay cone" />
        <canvas className="fx" ref={cvRef} aria-hidden="true" />
        <button className="th" ref={themeBtn} type="button" onClick={toggleTheme} aria-label="Toggle light and dark theme">
          <svg className="sn" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <svg className="mn" viewBox="0 0 24 24">
            <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
          </svg>
        </button>
        <button className="grab" ref={grabRefEl} type="button" role="switch" aria-checked="false" aria-label="Lamp cord. Pull to turn the light on">
          <i className="bead" />
        </button>
        <div className="lay bloom" />
        <main className="content">
          <section className="lamp-side" aria-label="Lamp">
            <div className="lamp-wrap" ref={wrapRef}>
              <svg className="lamp" viewBox="0 0 360 470" aria-hidden="true">
                <defs>
                  <linearGradient id="lg-sh" x1="0" x2="1">
                    <stop offset="0" style={{ stopColor: "var(--sh1)" }} />
                    <stop offset=".5" style={{ stopColor: "var(--sh2)" }} />
                    <stop offset="1" style={{ stopColor: "var(--sh1)" }} />
                  </linearGradient>
                  <linearGradient id="lg-po" x1="0" x2="1">
                    <stop offset="0" style={{ stopColor: "var(--p1)" }} />
                    <stop offset=".5" style={{ stopColor: "var(--p2)" }} />
                    <stop offset="1" style={{ stopColor: "var(--p1)" }} />
                  </linearGradient>
                </defs>
                <ellipse cx="180" cy="453" rx="70" ry="10" fill="#000" opacity=".35" />
                <path d="M118 448h124c0-10-14-16-30-18h-64c-16 2-30 8-30 18z" fill="url(#lg-po)" />
                <rect x="176" y="120" width="8" height="312" rx="4" fill="url(#lg-po)" />
                <g ref={headRef}>
                  <circle className="bulb" cx="180" cy="124" r="15" />
                  <path d="M104 118 L130 52 Q180 40 230 52 L256 118 Z" fill="url(#lg-sh)" />
                  <ellipse className="rim" cx="180" cy="118" rx="74" ry="4" />
                </g>
              </svg>
              <div className="hint">It's dark in here. Pull the cord to sign in.</div>
            </div>
          </section>

          <section className="card" ref={cardRef} inert={!lit} aria-hidden={!lit} aria-labelledby="lg-ttl">
            <div className="badge">{portal === "admin" ? "Authorised access" : "Students & Teachers"}</div>
            <h1 id="lg-ttl">Welcome back</h1>
            <p className="sub">Sign in to the Tufanganj Vivekananda Vidyalaya portal.</p>
            <form ref={formRef} onSubmit={f.onSubmit} noValidate>
              <div className={`field${f.errId ? " bad" : ""}`}>
                <input
                  id="lg-id"
                  ref={idRef}
                  type={copy.idType}
                  placeholder=" "
                  autoComplete={copy.idAutoComplete}
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={!!f.errId}
                  value={f.identifier}
                  onChange={(e) => f.setIdentifier(e.target.value)}
                />
                <label htmlFor="lg-id">{copy.idLabel}</label>
                <small className="err">{f.errId}</small>
              </div>
              <div className={`field${f.errPass ? " bad" : ""}`}>
                <input
                  id="lg-pass"
                  ref={passRef}
                  type={showPass ? "text" : "password"}
                  placeholder=" "
                  autoComplete="current-password"
                  aria-invalid={!!f.errPass}
                  value={f.password}
                  onChange={(e) => f.setPassword(e.target.value)}
                  onKeyDown={(e) => setCaps(e.getModifierState("CapsLock"))}
                  onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                  onBlur={() => setCaps(false)}
                />
                <label htmlFor="lg-pass">Password</label>
                <button className="eye" type="button" aria-pressed={showPass} aria-label={showPass ? "Hide password" : "Show password"} onClick={() => setShowPass((v) => !v)}>
                  {showPass ? "Hide" : "Show"}
                </button>
                <small className="err">{f.errPass}</small>
              </div>
              {caps && <div className="caps">Caps Lock is on.</div>}
              <div className="opts">
                <span>Forgot your password? Ask the school office.</span>
              </div>
              <button className={`cta${f.phase === "loading" ? " loading" : ""}${f.phase === "ok" ? " ok" : ""}`} type="submit" disabled={f.phase !== "idle"}>
                <span>{ctaLabel}</span>
              </button>
            </form>
            <div className="status" role="status" aria-live="polite" style={f.status.tone ? { color: f.status.tone === "bad" ? "var(--bad)" : "var(--acc)" } : undefined}>
              {f.status.text}
            </div>
            <div className="opts" style={{ marginTop: 14, marginBottom: 0 }}>
              <Link to="/">← School website</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
