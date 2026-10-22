import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { DEFAULT_ADJUST, MAX_ZOOM, formatAdjust, parseAdjust } from "../../lib/imageAdjust";
import type { Adjust, AdjustShape } from "../../lib/imageAdjust";
import { AdjustedImg } from "../../components/media/AdjustedImg";
import "./image-adjuster.css";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const HELP: Record<AdjustShape, string> = {
  circle: "This is how your round profile picture will look.",
  square: "This is how the square picture will look.",
  wide: "This is how the wide cover will look.",
  card: "This is how the picture will look on its card.",
  photo: "This is how the photo will look on the website.",
};

/**
 * Instagram-style "move and zoom": drag the picture inside the frame, use the slider (or pinch the slider with two
 * fingers' worth of patience) to zoom. The result is a tiny text value; the original picture is never changed or cut.
 */
export function ImageAdjuster({ src, value, onChange, shape }: { src: string; value: string; onChange: (v: string) => void; shape: AdjustShape }) {
  const a = parseAdjust(value);
  const frame = useRef<HTMLDivElement>(null);
  const nat = useRef<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [broken, setBroken] = useState(false);

  const set = (next: Adjust) => onChange(formatAdjust({ x: clamp(next.x, 0, 100), y: clamp(next.y, 0, 100), z: clamp(next.z, 1, MAX_ZOOM) }));

  /** How many screen pixels the picture can travel along each axis at the current zoom (exact for object-fit: cover). */
  function range() {
    const el = frame.current;
    const n = nat.current;
    if (!el || !n) return null;
    const fw = el.clientWidth;
    const fh = el.clientHeight;
    const s = Math.max(fw / n.w, fh / n.h);
    return { x: a.z * n.w * s - fw, y: a.z * n.h * s - fh };
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    drag.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const r = range();
    if (!d || !r) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY };
    set({ x: r.x > 0.5 ? a.x - (100 * dx) / r.x : a.x, y: r.y > 0.5 ? a.y - (100 * dy) / r.y : a.y, z: a.z });
  }
  function up() {
    drag.current = null;
    setDragging(false);
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 8 : 3;
    const map: Record<string, Adjust> = {
      ArrowLeft: { ...a, x: a.x + step }, ArrowRight: { ...a, x: a.x - step },
      ArrowUp: { ...a, y: a.y + step }, ArrowDown: { ...a, y: a.y - step },
      "+": { ...a, z: a.z + 0.1 }, "=": { ...a, z: a.z + 0.1 }, "-": { ...a, z: a.z - 0.1 },
    };
    if (map[e.key]) {
      e.preventDefault();
      set(map[e.key]);
    }
  }

  return (
    <div className="ia">
      <p className="ia-title">Position &amp; zoom</p>
      <div
        ref={frame}
        className={`ia-frame ia-${shape}${dragging ? " dragging" : ""}`}
        tabIndex={0}
        role="group"
        aria-label={`${HELP[shape]} Drag to move the picture. Arrow keys move it, plus and minus zoom.`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
      >
        {broken ? (
          <span className="ia-broken">Picture could not be shown</span>
        ) : (
          <AdjustedImg src={src} adjust={value} alt="" loading="eager" draggable={false} onLoad={(e) => { nat.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }; setBroken(false); }} onError={() => setBroken(true)} />
        )}
        <i className="ia-grid" aria-hidden="true" />
      </div>
      <div className="ia-controls">
        <label className="ia-zoom">
          <span>Zoom</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={a.z} onChange={(e) => set({ ...a, z: Number(e.target.value) })} aria-label="Zoom the picture" />
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange("")} disabled={formatAdjust(a) === "" || formatAdjust(a) === formatAdjust(DEFAULT_ADJUST)}>Reset</button>
      </div>
      <p className="ia-hint">{HELP[shape]} Drag the picture to move it. The original picture is not changed.</p>
    </div>
  );
}
