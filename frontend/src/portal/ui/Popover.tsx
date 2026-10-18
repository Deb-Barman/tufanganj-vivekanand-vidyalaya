import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { useIsSheet } from "./useIsSheet";

interface PopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  /** Shown as the heading of the phone bottom sheet. */
  title?: string;
  /** Make the floating menu at least as wide as its trigger (dropdowns). */
  matchWidth?: boolean;
  className?: string;
}

/**
 * Anchored, neumorphic popover. Renders in a portal (never clipped by a modal's
 * scroll area), flips above the trigger when there is no room below, closes on
 * outside tap / Escape, and turns into a bottom sheet on phones.
 */
export function Popover({ open, anchorRef, onClose, children, title, matchWidth, className = "" }: PopoverProps) {
  const sheet = useIsSheet();
  const el = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth?: number; maxHeight: number; up: boolean } | null>(null);

  const place = useCallback(() => {
    const a = anchorRef.current;
    const p = el.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const gap = 8;
    const vh = window.innerHeight;
    const below = vh - r.bottom - gap - 10;
    const above = r.top - gap - 10;
    const natural = p.scrollHeight;
    const up = natural > below && above > below;
    const maxHeight = Math.max(160, Math.min(natural, up ? above : below));
    const minWidth = matchWidth ? Math.max(r.width, 180) : undefined;
    const w = Math.max(p.offsetWidth, minWidth ?? 0);
    const left = Math.min(Math.max(10, r.left), Math.max(10, window.innerWidth - w - 10));
    setPos({ top: up ? r.top - gap - maxHeight : r.bottom + gap, left, minWidth, maxHeight, up });
  }, [anchorRef, el, matchWidth]);

  useLayoutEffect(() => {
    if (!open || sheet) return;
    // oxlint-disable-next-line react/set-state-in-effect
    place();
    const on = () => place();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [open, sheet, place, children]);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (el.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [open, onClose, anchorRef, el]);

  useEffect(() => {
    if (!open || !sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, sheet]);

  if (!open) return null;

  const stopEsc = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation(); // do not also close the modal the picker lives in
      onClose();
      anchorRef.current?.focus();
    }
  };

  if (sheet) {
    return createPortal(
      <div className="neo-sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={stopEsc}>
        <div ref={el} className={`neo-sheet ${className}`} role="dialog" aria-label={title}>
          <div className="neo-sheet-grip" aria-hidden="true" />
          {title && <p className="neo-sheet-title">{title}</p>}
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={el}
      className={`neo-pop ${pos?.up ? "up" : ""} ${className}`}
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, minWidth: pos?.minWidth, maxHeight: pos?.maxHeight, visibility: pos ? "visible" : "hidden" }}
      onKeyDown={stopEsc}
    >
      {children}
    </div>,
    document.body,
  );
}
