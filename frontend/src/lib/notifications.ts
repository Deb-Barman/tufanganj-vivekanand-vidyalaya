import { useSyncExternalStore } from "react";

/**
 * Notification history for the dashboard bell.
 *
 * Every message pop-up (toast) the dashboard shows is also kept here, in THIS browser only (localStorage, one list per
 * account). Nothing is sent to or saved on the school server / database. Clearing the browser's site data, or pressing
 * "Clear all", removes them.
 */

export type NoteKind = "success" | "error" | "info";
export interface Note {
  id: string;
  kind: NoteKind;
  text: string;
  /** ms since 1970 */
  at: number;
  read: boolean;
}

const MAX_NOTES = 80;
const EMPTY: Note[] = [];
const keyFor = (uid: string) => `tvv_notifications_v1:${uid}`;

// Same data as localStorage, kept in memory too (private mode / blocked storage still works for the open tab).
const lists = new Map<string, Note[]>();
const listeners = new Set<() => void>();

function load(uid: string): Note[] {
  const cached = lists.get(uid);
  if (cached) return cached;
  let parsed: Note[] = EMPTY;
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (Array.isArray(data)) {
        parsed = data
          .filter((n): n is Note => !!n && typeof n.id === "string" && typeof n.text === "string" && typeof n.at === "number")
          .slice(0, MAX_NOTES)
          .map((n) => ({ id: n.id, kind: n.kind === "error" || n.kind === "info" ? n.kind : "success", text: n.text.slice(0, 300), at: n.at, read: !!n.read }));
      }
    }
  } catch {
    /* unreadable or blocked: start empty */
  }
  lists.set(uid, parsed);
  return parsed;
}

function commit(uid: string, next: Note[]) {
  lists.set(uid, next);
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(next));
  } catch {
    /* storage full or blocked: the list still lives in memory */
  }
  listeners.forEach((l) => l());
}

let seq = 0;

/** Add one notification (newest first). The same text twice within 2 seconds is kept once. */
export function pushNote(uid: string, kind: NoteKind, text: string) {
  const clean = text.trim();
  if (!uid || !clean) return;
  const now = Date.now();
  const list = load(uid);
  if (list[0] && list[0].text === clean && list[0].kind === kind && now - list[0].at < 2000) return;
  const note: Note = { id: `${now.toString(36)}-${(++seq).toString(36)}`, kind, text: clean.slice(0, 300), at: now, read: false };
  commit(uid, [note, ...list].slice(0, MAX_NOTES));
}

export function markAllRead(uid: string) {
  const list = load(uid);
  if (list.some((n) => !n.read)) commit(uid, list.map((n) => (n.read ? n : { ...n, read: true })));
}

export function removeNote(uid: string, id: string) {
  commit(uid, load(uid).filter((n) => n.id !== id));
}

export function clearNotes(uid: string) {
  if (load(uid).length) commit(uid, []);
}

// Another tab of the same browser changed the list: pick it up.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith("tvv_notifications_v1:")) return;
    lists.delete(e.key.slice("tvv_notifications_v1:".length));
    listeners.forEach((l) => l());
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Live list for one account + how many are unread. */
export function useNotes(uid: string): { notes: Note[]; unread: number } {
  const notes = useSyncExternalStore(subscribe, () => load(uid), () => EMPTY);
  return { notes, unread: notes.reduce((n, x) => n + (x.read ? 0 : 1), 0) };
}
