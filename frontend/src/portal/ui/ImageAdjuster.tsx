import { useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { MAX_ZOOM, formatAdjust, parseAdjust } from "../../lib/imageAdjust";
import type { Adjust, AdjustShape } from "../../lib/imageAdjust";
import { AdjustedImg } from "../../components/media/AdjustedImg";
import "./image-adjuster.css";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const HELP: Record<AdjustShape, string> = {
  circle: "your round profile picture",
  square: "the square picture",
  wide: "the wide cover",
  card: "the picture on its card",
  photo: "the photo on the website",
};
/** Small previews of the finished result, so people see what everyone else will see. */
const PREVIEWS: Record<AdjustShape, { w: number; cls: string }[]> = {
  circle: [{ w: 56, cls: "circle" }, { w: 36, cls: "circle" }, { w: 24, cls: "circle" }],
  square: [{ w: 64, cls: "square" }, { w: 40, cls: "square" }],
  wide: [{ w: 132, cls: "wide" }],
  card: [{ w: 108, cls: "card" }],
  photo: [{ w: 120, cls: "photo" }],
};

const PlusIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
const MinusIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>;
const MoveIcon = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" /></svg>;

/**
 * Instagram-style "move and zoom": drag the picture inside the frame, zoom with the slider or the − / + buttons.
 * The result is a tiny text value; the original picture is never changed or cut. Small live previews show how the
 * finished picture looks at the sizes where people will actually see it.
 */
export function ImageAdjuster({ src, value, onChange, shape }: { src: string; value: string; onChange: (v: string) => void; shape: AdjustShape }) {
  const a = parseAdjust(value);
  const frame = useRef<HTMLDivElement>(null);
  const nat = useRef<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const [broken, setBroken] = useState(false);

  const set = (next: Adjust) => onChange(formatAdjust({ x: clamp(next.x, 0, 100), y: clamp(next.y, 0, 100), z: clamp(next.z, 1, MAX_ZOOM) }));
  const changed = formatAdjust(a) !== "";

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
    setTouched(true);
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
      setTouched(true);
      set(map[e.key]);
    }
  }
  const zoomBy = (d: number) => set({ ...a, z: a.z + d });

  return (
    <div className="ia">
      <div className="ia-head">
        <span className="ia-title">Position &amp; zoom</span>
        <button type="button" className="ia-reset" onClick={() => onChange("")} disabled={!changed}>Reset</button>
      </div>

      <div className="ia-stage">
        <div
          ref={frame}
          className={`ia-frame ia-${shape}${dragging ? " dragging" : ""}`}
          tabIndex={0}
          role="group"
          aria-label={`Preview of ${HELP[shape]}. Drag to move the picture. Arrow keys move it, plus and minus zoom.`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        >
          {broken ? (
            <span className="ia-broken">This picture could not be shown. Check that sharing is set to “Anyone with the link”.</span>
          ) : (
            <AdjustedImg src={src} adjust={value} alt="" loading="eager" draggable={false} onLoad={(e) => { nat.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }; setBroken(false); }} onError={() => setBroken(true)} />
          )}
          <i className="ia-grid" aria-hidden="true" />
          {!touched && !broken && <span className="ia-chip"><MoveIcon /> Drag to move</span>}
        </div>
      </div>

      <div className="ia-zoom">
        <button type="button" className="ia-step" onClick={() => zoomBy(-0.25)} disabled={a.z <= 1} aria-label="Zoom out"><MinusIcon /></button>
        <input className="ia-range" type="range" min={1} max={MAX_ZOOM} step={0.01} value={a.z} style={{ ["--p" as string]: `${((a.z - 1) / (MAX_ZOOM - 1)) * 100}%` } as CSSProperties} onChange={(e) => { setTouched(true); set({ ...a, z: Number(e.target.value) }); }} aria-label="Zoom the picture" />
        <button type="button" className="ia-step" onClick={() => zoomBy(0.25)} disabled={a.z >= MAX_ZOOM} aria-label="Zoom in"><PlusIcon /></button>
        <output className="ia-level">{a.z.toFixed(1)}×</output>
      </div>

      {!broken && (
        <div className="ia-previews" aria-hidden="true">
          <span>Preview</span>
          {PREVIEWS[shape].map((p) => (
            <span key={p.w} className={`ia-pv ia-${p.cls}`} style={{ width: p.w }}><AdjustedImg src={src} adjust={value} alt="" /></span>
          ))}
        </div>
      )}
      <p className="ia-hint">Drag the picture to move it. Your original picture is never changed.</p>
    </div>
  );
}
