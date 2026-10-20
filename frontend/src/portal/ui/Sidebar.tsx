import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { SchoolLogo } from "../../components/SchoolLogo";
import { SITE } from "../../config/site";
import type { User } from "../../types/api";
import { RoleBadge } from "../components/RoleBadge";
import { Icon } from "./icons";
import { Avatar } from "./kit";
import { dashPath } from "./nav";
import type { NavItem } from "./nav";
import "./sidebar.css";

const CLOSED_KEY = "tvv_nav_closed_groups";
const readClosed = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLOSED_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
};

export interface SidebarProps {
  user: User;
  groups: { group: string; items: NavItem[] }[];
  /** Phone/tablet: whether the menu sheet is open. */
  open: boolean;
  onClose: () => void;
  /** Desktop: collapsed to a slim icon rail. */
  rail: boolean;
  onToggleRail: () => void;
  onLogout: () => void;
  onQuickJump: () => void;
  /** The current path, used to keep the active section open. */
  activePath: string;
  /** Small number bubbles per page, e.g. { admissions: 3 }. */
  badges?: Record<string, number>;
}

export function Sidebar({ user, groups, open, onClose, rail, onToggleRail, onLogout, onQuickJump, activePath, badges = {} }: SidebarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(readClosed);
  const q = query.trim().toLowerCase();

  const activeGroup = useMemo(() => {
    const clean = activePath.replace(/\/$/, "");
    return groups.find((g) => g.items.some((i) => dashPath(i.to) === clean))?.group;
  }, [groups, activePath]);

  const visible = useMemo(
    () => groups.map((g) => ({ ...g, items: q ? g.items.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(q)) : g.items })).filter((g) => g.items.length > 0),
    [groups, q],
  );
  const matches = q ? visible.reduce((n, g) => n + g.items.length, 0) : 0;

  const toggleGroup = (name: string) => {
    setClosed((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        localStorage.setItem(CLOSED_KEY, JSON.stringify([...next]));
      } catch {
        /* private mode: the groups simply will not be remembered */
      }
      return next;
    });
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setQuery("");
    if (e.key === "Enter" && visible[0]?.items[0]) {
      navigate(dashPath(visible[0].items[0].to));
      setQuery("");
    }
  };

  const name = user.full_name || user.username;
  return (
    <aside className={`console-side sb${open ? " open" : ""}${rail ? " is-rail" : ""}`} aria-label="Dashboard navigation">
      <div className="sb-head">
        <Link to="/" className="sb-brand" aria-label={`${SITE.short} — public website`}>
          <SchoolLogo size={36} />
          <span className="sb-brand-text">
            <strong>{SITE.short}</strong>
            <small>Dashboard</small>
          </span>
        </Link>
        <button type="button" className="sb-iconbtn sb-close" onClick={onClose} aria-label="Close menu">
          <Icon name="x" size={20} />
        </button>
        <button type="button" className="sb-iconbtn sb-rail-toggle" onClick={onToggleRail} aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={rail} title={rail ? "Expand sidebar" : "Collapse sidebar"}>
          <Icon name={rail ? "chevronRight" : "chevronLeft"} size={18} />
        </button>
      </div>

      <NavLink to={dashPath("profile")} className="sb-account" title="Open my profile">
        <Avatar name={name} size={44} />
        <span className="sb-account-text">
          <span className="sb-account-name">{name}</span>
          <span className="sb-account-meta"><RoleBadge role={user.role} /></span>
        </span>
        <Icon name="chevronRight" size={18} />
      </NavLink>

      <div className="sb-search">
        <Icon name="search" size={17} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} placeholder="Search pages…" aria-label="Search dashboard pages" enterKeyHint="go" autoComplete="off" />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="x" size={14} /></button>
        )}
      </div>
      <button type="button" className="sb-rail-search" onClick={onQuickJump} aria-label="Quick jump" title="Quick jump (Ctrl K)"><Icon name="search" size={19} /></button>

      <nav className="sb-nav" aria-label="Sections">
        {visible.map((g) => {
          const isOpen = !!q || !closed.has(g.group) || g.group === activeGroup;
          const id = `sb-g-${g.group.replace(/\W+/g, "-")}`;
          return (
            <section className={`sb-group${isOpen ? " is-open" : ""}`} key={g.group}>
              <button type="button" className="sb-group-head" onClick={() => toggleGroup(g.group)} aria-expanded={isOpen} aria-controls={id} disabled={!!q || g.group === activeGroup} title={g.group === activeGroup ? "This section contains the page you are on" : undefined}>
                <span>{g.group}</span>
                <small>{g.items.length}</small>
                <Icon name="chevronDown" size={15} />
              </button>
              {isOpen && (
                <div className="sb-items" id={id}>
                  {g.items.map((item) => {
                    const count = badges[item.to] ?? 0;
                    return (
                      <NavLink key={item.to || "home"} to={dashPath(item.to)} end={item.to === ""} className={({ isActive }) => `sb-item${isActive ? " active" : ""}`} title={item.label} aria-label={count ? `${item.label}, ${count} waiting` : undefined}>
                        <span className="sb-ico"><Icon name={item.icon} size={19} /></span>
                        <span className="sb-txt">
                          <b>{item.label}</b>
                          <small>{item.hint}</small>
                        </span>
                        {count > 0 && <span className="sb-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
                        <Icon name="chevronRight" size={16} />
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {q && matches === 0 && <p className="sb-none">No page matches “{query.trim()}”.</p>}
      </nav>

      <div className="sb-foot">
        <button type="button" className="sb-kbd" onClick={onQuickJump}>
          <span><Icon name="search" size={16} /> Quick jump</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="sb-foot-row">
          <Link to="/" className="sb-foot-btn" title="View website"><Icon name="external" size={18} /><span>View website</span></Link>
          <button type="button" className="sb-foot-btn sb-logout" onClick={onLogout} title="Log out"><Icon name="logout" size={18} /><span>Log out</span></button>
        </div>
      </div>
    </aside>
  );
}
