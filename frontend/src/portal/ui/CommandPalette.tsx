import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./icons";
import { dashPath } from "./nav";
import type { NavItem } from "./nav";

/** ⌘K / Ctrl+K (or the search button) — jump to any page the role may open. */
export function CommandPalette({ items, open, onClose }: { items: NavItem[]; open: boolean; onClose: () => void }) {
  // Mounted only while open, so the query/selection reset naturally every time.
  return open ? <PaletteBody items={items} onClose={onClose} /> : null;
}

function PaletteBody({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label} ${i.hint} ${i.group}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const go = (item: NavItem) => {
    navigate(dashPath(item.to));
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[index]) go(results[index]);
  };

  return (
    <div className="cmdk-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Jump to page" onKeyDown={onKey}>
        <div className="cmdk-input">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            placeholder="Jump to… (attendance, admissions, accounts)"
            aria-label="Search pages"
          />
        </div>
        <div className="cmdk-list">
          {results.length === 0 ? (
            <p className="cmdk-empty">Nothing matches “{query}”.</p>
          ) : (
            results.map((item, i) => (
              <button key={item.to || "home"} type="button" className={`cmdk-item ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => go(item)}>
                <Icon name={item.icon} />
                <span>
                  <b>{item.label}</b>
                  <small>{item.hint}</small>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
