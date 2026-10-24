import { useRef } from "react";
import type { ReactNode } from "react";

/** Wraps a button/link so it leans toward the mouse a little (mouse devices only). */
export function Magnetic({ children }: { children: ReactNode }) {
  const box = useRef<HTMLSpanElement>(null);
  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mgx", `${((e.clientX - (r.left + r.width / 2)) / r.width) * 14}px`);
    el.style.setProperty("--mgy", `${((e.clientY - (r.top + r.height / 2)) / r.height) * 12}px`);
  };
  const leave = () => {
    box.current?.style.setProperty("--mgx", "0px");
    box.current?.style.setProperty("--mgy", "0px");
  };
  return <span className="magnetic" ref={box} onPointerMove={move} onPointerLeave={leave}>{children}</span>;
}
