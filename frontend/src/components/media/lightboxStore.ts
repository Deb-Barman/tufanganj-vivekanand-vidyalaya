export interface LightboxItem {
  src: string;
  alt?: string;
  caption?: string;
}
export interface LbState {
  items: LightboxItem[];
  index: number;
}

let state: LbState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribeLightbox = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const getLightbox = () => state;

/** Show picture(s) full screen. Works from anywhere — no provider needed (the viewer is mounted once in main.tsx). */
export function openLightbox(items: LightboxItem | LightboxItem[], index = 0) {
  const list = (Array.isArray(items) ? items : [items]).filter((i) => i.src);
  if (list.length === 0) return;
  state = { items: list, index: Math.min(Math.max(0, index), list.length - 1) };
  emit();
}
export function closeLightbox() {
  state = null;
  emit();
}
