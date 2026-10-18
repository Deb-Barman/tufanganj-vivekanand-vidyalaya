import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from "react";
import { Icon } from "./icons";
import { Popover } from "./Popover";
import "./neo-fields.css";

export interface SelectChangeEvent {
  target: { value: string };
}

interface Opt {
  value: string;
  label: string;
  disabled: boolean;
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

/** Reads <option> children exactly like a native <select> would. */
function parseOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.toArray(children).forEach((c) => {
    if (!isValidElement(c) || c.type !== "option") return;
    const p = (c as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>).props;
    const label = textOf(p.children);
    out.push({ value: p.value === undefined ? label : String(p.value), label, disabled: !!p.disabled });
  });
  return out;
}

interface SelectProps {
  id?: string;
  value: string | number | undefined;
  onChange?: (e: SelectChangeEvent) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  /** Adds a search box to the menu — use for long lists (people, classes). */
  searchable?: boolean;
  placeholder?: string;
  children?: ReactNode;
}

/**
 * Drop-in replacement for <select> with the site's neumorphic look.
 * Same API: <Select value onChange={(e) => … e.target.value}><option/>…</Select>.
 * Floating menu on desktop, bottom sheet on phones, full keyboard support.
 */
export function Select({ id, value, onChange, disabled, className = "", style, searchable, placeholder = "Select…", children, ...rest }: SelectProps) {
  const options = useMemo(() => parseOptions(children), [children]);
  const current = String(value ?? "");
  const selected = options.find((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const btn = useRef<HTMLButtonElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const typed = useRef({ text: "", at: 0 });
  const uid = useId();
  const listId = `${uid}-list`;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const openMenu = () => {
    if (disabled) return;
    const i = shown.findIndex((o) => o.value === current);
    setActive(i >= 0 ? i : Math.max(0, shown.findIndex((o) => !o.disabled)));
    setOpen(true);
  };

  const pick = (o: Opt | undefined) => {
    if (!o || o.disabled) return;
    if (o.value !== current) onChange?.({ target: { value: o.value } });
    close();
    btn.current?.focus();
  };

  // Keep the keyboard-highlighted option in view and focus the search box when there is one.
  useEffect(() => {
    if (!open) return;
    document.getElementById(listId)?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, shown.length, listId]);
  useEffect(() => {
    if (open && searchable) search.current?.focus({ preventScroll: true });
  }, [open, searchable]);

  const move = (dir: 1 | -1, from = active) => {
    if (shown.length === 0) return;
    let i = from;
    for (let n = 0; n < shown.length; n++) {
      i = (i + dir + shown.length) % shown.length;
      if (!shown[i].disabled) return setActive(i);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key) && e.target === btn.current) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(Math.max(0, shown.length - 1)); }
    else if (e.key === "Enter" || (e.key === " " && !searchable)) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === "Tab") close();
    else if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at > 600 ? "" : typed.current.text) + e.key.toLowerCase(), at: now };
      const hit = shown.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`neo-select ${open ? "open" : ""} ${selected && !(selected.value === "" && /^(—|-|choose|select|pick|none)/i.test(selected.label)) ? "" : "is-empty"} ${className}`}
        style={style}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest["aria-label"]}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKey}
        onKeyUp={(e) => e.key === " " && e.preventDefault()}
      >
        <span className="neo-select-text">{selected && (selected.value !== "" || selected.label) ? selected.label : placeholder}</span>
        <Icon name="chevronDown" size={18} className="neo-chevron" />
      </button>
      <Popover open={open} anchorRef={btn} onClose={close} matchWidth title={rest["aria-label"] ?? "Choose an option"} className="neo-menu">
        {searchable && (
          <div className="neo-search">
            <Icon name="search" size={16} />
            <input
              ref={search}
              value={query}
              placeholder="Search…"
              aria-label="Search options"
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKey}
            />
          </div>
        )}
        <div id={listId} role="listbox" className="neo-list" aria-label={rest["aria-label"]} tabIndex={-1} onKeyDown={onKey}>
          {shown.length === 0 && <p className="neo-empty">Nothing found</p>}
          {shown.map((o, i) => (
            <button
              key={`${o.value}-${i}`}
              type="button"
              role="option"
              data-i={i}
              aria-selected={o.value === current}
              disabled={o.disabled}
              tabIndex={-1}
              className={`neo-opt ${o.value === current ? "selected" : ""} ${i === active ? "active" : ""}`}
              onPointerMove={() => i !== active && setActive(i)}
              onClick={() => pick(o)}
            >
              <span>{o.label || "—"}</span>
              {o.value === current && <Icon name="check" size={17} />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
