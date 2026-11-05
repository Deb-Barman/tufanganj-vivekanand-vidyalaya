import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../lib/theme";
import { loginCopy, useLoginForm } from "./useLoginForm";
import type { LoginViewProps } from "./types";
import "./KoiLogin.css";

type Pt = [number, number];
interface Target {
  x: number;
  y: number;
  ox: number;
  oy: number;
}
interface Ripple {
  x: number;
  y: number;
  r: number;
  a: number;
}

/**
 * "Koi" login — a neumorphic card with a koi swimming around it. The fish
 * simulation is a straight port of koi-login-neumorphic.html; only the form
 * underneath is wired to the real school backend.
 */
export default function KoiLogin({ portal, initialNotice, onSigningIn, onSuccess }: LoginViewProps) {
  const { resolved } = useTheme();
  const boxRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const exciteRef = useRef<() => void>(() => {});
  const redrawRef = useRef<() => void>(() => {});
  const [showPass, setShowPass] = useState(false);

  const copy = loginCopy(portal);
  const f = useLoginForm({ portal, initialNotice, onSigningIn, onSuccess, formRef, idRef, passRef });

  useEffect(() => {
    if (f.phase !== "idle") exciteRef.current();
  }, [f.phase]);

  // Theme changes need one repaint when the fish is frozen (reduced motion).
  useEffect(() => {
    redrawRef.current();
  }, [resolved]);

  useEffect(() => {
    const box = boxRef.current!;
    const cv = cvRef.current!;
    const card = cardRef.current!;
    const cx = cv.getContext("2d")!;
    const still = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    /* ---------- Koi ---------- */
    const N = 26;
    let W = 0,
      H = 0,
      dpr = 1,
      ph = 0,
      exc = 0,
      last = 0,
      rt = 0,
      raf = 0,
      stopped = false;
    let rip: Ripple[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const fish = {
      x: 0,
      y: 0,
      a: 0,
      v: 90,
      wp: null as { x: number; y: number } | null,
      wpT: 0,
      tg: null as Target | null,
      tgT: 0,
      sw: 0,
      side: Math.random() < 0.5 ? 1 : -1,
      seed: [rnd(0, 9), rnd(0, 9), rnd(0, 9)],
      ch: [] as Pt[],
    };
    const SZ = () => (W < 520 ? 0.74 : 1);
    const boxOf = (m: number) => {
      const r = card.getBoundingClientRect();
      return { l: r.left - m, t: r.top - m, r: r.right + m, b: r.bottom + m };
    };
    type Box = ReturnType<typeof boxOf>;
    const inBox = (x: number, y: number, b: Box) => x > b.l && x < b.r && y > b.t && y < b.b;
    function outside(x: number, y: number, m: number): Pt {
      const b = boxOf(m);
      if (!inBox(x, y, b)) return [x, y];
      const d = [x - b.l, b.r - x, y - b.t, b.b - y],
        i = d.indexOf(Math.min(...d));
      return i === 0 ? [b.l - 6, y] : i === 1 ? [b.r + 6, y] : i === 2 ? [x, b.t - 6] : [x, b.b + 6];
    }
    function pick() {
      for (let k = 0; k < 30; k++) {
        const x = rnd(50, W - 50),
          y = rnd(50, H - 50);
        if (!inBox(x, y, boxOf(30))) return { x, y };
      }
      return { x: W * 0.15, y: H * 0.2 };
    }
    function chain() {
      const S = SZ();
      fish.ch = [];
      for (let i = 0; i < N; i++) fish.ch.push([fish.x - Math.cos(fish.a) * i * 5.4 * S, fish.y - Math.sin(fish.a) * i * 5.4 * S]);
    }
    function reset() {
      const p = pick();
      fish.x = p.x;
      fish.y = p.y;
      fish.a = rnd(0, 6.28);
      chain();
      fish.wp = pick();
      fish.wpT = rnd(4, 9);
    }
    function size() {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr;
      cv.height = H * dpr;
      if (!fish.ch.length) reset();
      if (still) frame(performance.now());
    }
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    function smooth(p: Pt[]) {
      const n = p.length,
        m = mid(p[n - 1], p[0]);
      cx.moveTo(m[0], m[1]);
      for (let i = 0; i < n; i++) {
        const c = mid(p[i], p[(i + 1) % n]);
        cx.quadraticCurveTo(p[i][0], p[i][1], c[0], c[1]);
      }
    }
    function fin(b: Pt, tn: Pt, nm: Pt, len: number, wd: number, sway: number, a: number) {
      /* tail fin */
      const tip1: Pt = [b[0] + tn[0] * len + nm[0] * (wd + sway), b[1] + tn[1] * len + nm[1] * (wd + sway)],
        tip2: Pt = [b[0] + tn[0] * len - nm[0] * (wd - sway), b[1] + tn[1] * len - nm[1] * (wd - sway)],
        nt: Pt = [b[0] + tn[0] * len * 0.55 + nm[0] * sway * 0.6, b[1] + tn[1] * len * 0.55 + nm[1] * sway * 0.6];
      cx.beginPath();
      cx.moveTo(b[0] + nm[0] * 2, b[1] + nm[1] * 2);
      cx.quadraticCurveTo(b[0] + tn[0] * len * 0.5 + nm[0] * (wd + sway) * 0.9, b[1] + tn[1] * len * 0.5 + nm[1] * (wd + sway) * 0.9, tip1[0], tip1[1]);
      cx.quadraticCurveTo(nt[0] + nm[0] * 4, nt[1] + nm[1] * 4, nt[0], nt[1]);
      cx.quadraticCurveTo(nt[0] - nm[0] * 4, nt[1] - nm[1] * 4, tip2[0], tip2[1]);
      cx.quadraticCurveTo(b[0] + tn[0] * len * 0.5 - nm[0] * (wd - sway) * 0.9, b[1] + tn[1] * len * 0.5 - nm[1] * (wd - sway) * 0.9, b[0] - nm[0] * 2, b[1] - nm[1] * 2);
      cx.closePath();
      cx.globalAlpha = a;
      cx.fill();
      cx.globalAlpha = 1;
    }
    function pec(p: Pt, tn: Pt, nm: Pt, side: number, S: number, fl: number) {
      /* pectoral fin */
      const b: Pt = [p[0] + nm[0] * side * S * 9, p[1] + nm[1] * side * S * 9],
        tip: Pt = [b[0] + nm[0] * side * S * (15 + fl) - tn[0] * S * 17, b[1] + nm[1] * side * S * (15 + fl) - tn[1] * S * 17];
      cx.beginPath();
      cx.moveTo(b[0] + tn[0] * S * 3, b[1] + tn[1] * S * 3);
      cx.quadraticCurveTo(b[0] + nm[0] * side * S * 14 + tn[0] * S * 2, b[1] + nm[1] * side * S * 14 + tn[1] * S * 2, tip[0], tip[1]);
      cx.quadraticCurveTo(b[0] + nm[0] * side * S * 7 - tn[0] * S * 13, b[1] + nm[1] * side * S * 7 - tn[1] * S * 13, b[0] - tn[0] * S * 4, b[1] - tn[1] * S * 4);
      cx.closePath();
      cx.globalAlpha = 0.8;
      cx.fill();
      cx.globalAlpha = 1;
    }
    function koi(S: number) {
      const sp: Pt[] = [],
        aw = 0.6 + 0.4 * Math.min(1, fish.v / 120);
      for (let i = 0; i < N; i++) {
        const c = fish.ch,
          a = c[Math.max(0, i - 1)],
          b = c[Math.min(N - 1, i + 1)],
          dx = a[0] - b[0],
          dy = a[1] - b[1],
          d = Math.hypot(dx, dy) || 1,
          o = Math.sin(ph - i * 0.42) * S * (0.5 + i * 0.34) * aw;
        sp.push([c[i][0] - (dy / d) * o, c[i][1] + (dx / d) * o]);
      }
      const tg: Pt[] = sp.map((_, i) => {
        const a = sp[Math.max(0, i - 1)],
          b = sp[Math.min(N - 1, i + 1)],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          d = Math.hypot(dx, dy) || 1;
        return [dx / d, dy / d];
      });
      const wd = sp.map((_, i) => {
        const t = i / (N - 1);
        return S * 14 * Math.pow(Math.sin(Math.PI * (0.12 + 0.85 * Math.pow(t, 0.8))), 0.7);
      });
      const Lp: Pt[] = sp.map((p, i) => [p[0] - tg[i][1] * wd[i], p[1] + tg[i][0] * wd[i]]),
        Rp: Pt[] = sp.map((p, i) => [p[0] + tg[i][1] * wd[i], p[1] - tg[i][0] * wd[i]]);
      const nose: Pt = [sp[0][0] - tg[0][0] * wd[0] * 0.95, sp[0][1] - tg[0][1] * wd[0] * 0.95];
      const body: Pt[] = [nose, ...Lp, ...Rp.reverse()];
      const fl = Math.sin(ph * 0.8) * S * 3,
        e = N - 1,
        tn: Pt = [-tg[e][0], -tg[e][1]];
      void tn;
      cx.save();
      cx.fillStyle = getComputedStyle(box).getPropertyValue("--fish");
      cx.shadowColor = "rgba(0,0,0,.28)";
      cx.shadowBlur = 16 * S;
      cx.shadowOffsetX = 5 * S;
      cx.shadowOffsetY = 9 * S;
      /* fins (behind body) */
      fin(sp[e], [tg[e][0], tg[e][1]], [-tg[e][1], tg[e][0]], S * 34, S * 15, Math.sin(ph - e * 0.42 - 0.7) * S * 11, 0.82);
      const fw: Pt = [-tg[6][0], -tg[6][1]];
      pec(sp[6], fw, [-tg[6][1], tg[6][0]], 1, S, fl);
      pec(sp[6], fw, [-tg[6][1], tg[6][0]], -1, S, -fl);
      cx.beginPath();
      smooth(body);
      cx.fill();
      cx.restore();
      /* patches, clipped to body */
      cx.save();
      cx.beginPath();
      smooth(body);
      cx.clip();
      cx.lineCap = "round";
      cx.lineJoin = "round";
      const seg = (a: number, b: number, w: number, c: string) => {
        cx.beginPath();
        cx.moveTo(sp[a][0], sp[a][1]);
        for (let i = a + 1; i <= b; i++) cx.lineTo(sp[i][0], sp[i][1]);
        cx.strokeStyle = c;
        cx.lineWidth = w;
        cx.stroke();
      };
      seg(0, 5, S * 30, "#e24a3b");
      seg(0, 3, S * 22, "#ee5a45");
      seg(10, 15, S * 22, "#ef7d3a");
      seg(18, 20, S * 13, "#e24a3b");
      cx.restore();
      cx.beginPath();
      smooth(body);
      cx.strokeStyle = "rgba(120,128,180,.28)";
      cx.lineWidth = 1;
      cx.stroke();
      /* eyes */
      cx.fillStyle = "#2a2430";
      [1, -1].forEach((s) => {
        cx.beginPath();
        cx.arc(sp[2][0] - tg[2][1] * s * wd[2] * 0.72, sp[2][1] + tg[2][0] * s * wd[2] * 0.72, S * 1.9, 0, 7);
        cx.fill();
      });
    }
    function steer(dt: number, t: number) {
      const S = SZ(),
        fs = fish;
      fs.wpT -= dt;
      if (fs.tg) {
        fs.tgT -= dt;
        fs.sw -= dt;
        if (fs.tgT <= 0) fs.tg = null;
        else if (fs.sw <= 0 && Math.hypot(fs.tg.x - fs.x, fs.tg.y - fs.y) < 70 * S) {
          const o = outside(fs.tg.ox + rnd(-90, 90), fs.tg.oy + rnd(-90, 90), 26);
          fs.tg.x = o[0];
          fs.tg.y = o[1];
          fs.sw = rnd(0.5, 1.2);
        }
      } else if (Math.hypot(fs.wp!.x - fs.x, fs.wp!.y - fs.y) < 70 * S || fs.wpT <= 0) {
        fs.wp = pick();
        fs.wpT = rnd(4, 9);
        if (Math.random() < 0.4) fs.side *= -1;
      }
      const T = fs.tg || fs.wp!;
      let dx = T.x - fs.x,
        dy = T.y - fs.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      /* smooth random drift while roaming */
      const nz = Math.sin(t * 0.0007 + fs.seed[0]) * 0.9 + Math.sin(t * 0.0019 + fs.seed[1]) * 0.5 + Math.sin(t * 0.00031 + fs.seed[2]) * 0.7;
      const ang = Math.atan2(dy, dx) + (fs.tg ? 0 : nz * 0.7);
      let vx = Math.cos(ang),
        vy = Math.sin(ang);
      /* steer around the card */
      const b = boxOf(24),
        ll = 40 * S + fs.v * 0.55,
        la = [fs.x + Math.cos(fs.a) * ll, fs.y + Math.sin(fs.a) * ll],
        lb = [fs.x + Math.cos(fs.a) * ll * 0.5, fs.y + Math.sin(fs.a) * ll * 0.5];
      const av = inBox(la[0], la[1], b) || inBox(lb[0], lb[1], b) || inBox(fs.x, fs.y, b);
      if (av) {
        let ax = fs.x - (b.l + b.r) / 2,
          ay = fs.y - (b.t + b.b) / 2;
        const m = Math.hypot(ax, ay) || 1;
        ax /= m;
        ay /= m;
        vx += ax * 1.8 - ay * 1.3 * fs.side;
        vy += ay * 1.8 + ax * 1.3 * fs.side;
      }
      /* stay on screen */
      const e = 60 * S;
      if (fs.x < e) vx += ((e - fs.x) / e) * 2;
      if (fs.x > W - e) vx -= ((fs.x - (W - e)) / e) * 2;
      if (fs.y < e) vy += ((e - fs.y) / e) * 2;
      if (fs.y > H - e) vy -= ((fs.y - (H - e)) / e) * 2;
      let da = Math.atan2(vy, vx) - fs.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const turn = (2.4 + 1.4 * exc) * (av ? 1.7 : 1);
      fs.a += cl(da, -turn * dt, turn * dt);
      /* speed: lazy bursts when free, a rush toward a click, easing in on arrival */
      let sv = (fs.tg ? 170 + 120 * Math.min(1, d / 450) : 85 + 35 * Math.sin(t * 0.0009 + fs.seed[1])) * S;
      if (fs.tg && d < 90 * S) sv = Math.max(55 * S, (sv * d) / (90 * S));
      fs.v += (sv - fs.v) * Math.min(1, dt * 2.2);
      fs.x = cl(fs.x + Math.cos(fs.a) * fs.v * dt, 6, W - 6);
      fs.y = cl(fs.y + Math.sin(fs.a) * fs.v * dt, 6, H - 6);
    }
    function frame(t: number) {
      if (stopped) return;
      const dt = Math.min(0.05, (t - last) / 1e3 || 0);
      last = t;
      const S = SZ();
      exc *= Math.exp(-dt * 0.9);
      if (!still) {
        steer(dt, t);
        ph += dt * (3.2 + fish.v * 0.045) * (1 + 0.3 * exc);
        const c = fish.ch,
          g = 5.4 * S;
        c[0][0] = fish.x;
        c[0][1] = fish.y;
        for (let i = 1; i < N; i++) {
          const dx = c[i - 1][0] - c[i][0],
            dy = c[i - 1][1] - c[i][1],
            d = Math.hypot(dx, dy) || 1;
          c[i][0] = c[i - 1][0] - (dx / d) * g;
          c[i][1] = c[i - 1][1] - (dy / d) * g;
        }
        rt += dt;
        if (rt > 0.5 - 0.25 * Math.min(1, fish.v / 150)) {
          rt = 0;
          rip.push({ x: fish.x, y: fish.y, r: 4, a: 0.26 });
        }
      }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, W, H);
      const rc = getComputedStyle(box).getPropertyValue("--ripple");
      rip = rip.filter((p) => p.a > 0.01);
      rip.forEach((p) => {
        p.r += dt * (52 + 30 * exc);
        p.a *= Math.exp(-dt * 1.5);
        cx.beginPath();
        cx.arc(p.x, p.y, p.r, 0, 7);
        cx.strokeStyle = "rgba(" + rc + "," + p.a.toFixed(3) + ")";
        cx.lineWidth = 1.5;
        cx.stroke();
      });
      koi(S);
      if (!still) raf = requestAnimationFrame(frame);
    }
    const onResize = () => size();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => {
      if (still) size();
    });
    ro.observe(card);
    /* click or tap anywhere: the koi swims over (never under the card) */
    const onPointer = (e: PointerEvent) => {
      const x = e.clientX,
        y = e.clientY,
        o = outside(x, y, 26);
      rip.push({ x, y, r: 6, a: 0.45 }, { x, y, r: 0, a: 0.28 });
      fish.tg = { x: o[0], y: o[1], ox: o[0], oy: o[1] };
      fish.tgT = 6;
      fish.sw = 0;
      exc = 1;
      if (hintRef.current) hintRef.current.style.opacity = "0";
      if (still) {
        fish.x = o[0];
        fish.y = o[1];
        chain();
        frame(performance.now());
      }
    };
    window.addEventListener("pointerdown", onPointer);
    const onFocus = () => {
      exc = Math.min(1, exc + 0.6);
    };
    card.addEventListener("focusin", onFocus);

    exciteRef.current = () => {
      exc = 1;
    };
    redrawRef.current = () => {
      if (still) frame(performance.now());
    };

    size();
    raf = requestAnimationFrame(frame);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onPointer);
      card.removeEventListener("focusin", onFocus);
      ro.disconnect();
    };
  }, []);

  const ctaLabel = f.phase === "ok" ? "Welcome back" : "Sign in";

  return (
    <div className={`lg-koi${portal === "staff" ? " has-fp" : ""}`} ref={boxRef}>
      <canvas className="fx" ref={cvRef} aria-hidden="true" />

      <p className="hint" ref={hintRef}>
        Tap anywhere and the koi will swim to you.
      </p>
      <main className="card" ref={cardRef}>
        <h1>Login to your account</h1>
        <p className="sub">{portal === "admin" ? "Authorised access only." : "Students & Teachers · Tufanganj Vivekananda Vidyalaya"}</p>
        <form ref={formRef} onSubmit={f.onSubmit} noValidate>
          <div className={`f${f.errId ? " bad" : ""}`}>
            <input
              id="koi-id"
              ref={idRef}
              type={copy.idType}
              placeholder=" "
              autoComplete={copy.idAutoComplete}
              autoCapitalize="none"
              spellCheck={false}
              value={f.identifier}
              onChange={(e) => f.setIdentifier(e.target.value)}
            />
            <label htmlFor="koi-id">{copy.idLabel}</label>
            <small className="err">{f.errId}</small>
          </div>
          <div className={`f${f.errPass ? " bad" : ""}`}>
            <input
              id="koi-pass"
              ref={passRef}
              type={showPass ? "text" : "password"}
              placeholder=" "
              autoComplete="current-password"
              value={f.password}
              onChange={(e) => f.setPassword(e.target.value)}
            />
            <label htmlFor="koi-pass">Password</label>
            <button
              className="eye"
              type="button"
              aria-pressed={showPass}
              aria-label={showPass ? "Hide password" : "Show password"}
              onClick={() => setShowPass((v) => !v)}
            >
              {showPass ? "Hide" : "Show"}
            </button>
            <small className="err">{f.errPass}</small>
          </div>
          <button className={`cta${f.phase === "loading" ? " load" : ""}${f.phase === "ok" ? " ok" : ""}`} type="submit" disabled={f.phase !== "idle"}>
            <span>{ctaLabel}</span>
          </button>
        </form>
        <div className="st" role="status" aria-live="polite" style={f.status.tone ? { color: f.status.tone === "bad" ? "var(--bad)" : "var(--ok)" } : undefined}>
          {f.status.text}
        </div>
        <p className="sw">
          Accounts are issued by the school office. <Link className="lnk" to="/">School website</Link>
        </p>
      </main>
    </div>
  );
}
