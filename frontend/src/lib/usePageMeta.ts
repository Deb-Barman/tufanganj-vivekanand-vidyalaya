import { useEffect } from "react";
import { SITE } from "../config/site";

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Per-page <title>, description, canonical and social-share tags. */
export function usePageMeta(title: string, description: string, path?: string) {
  useEffect(() => {
    const full = title ? `${title} | ${SITE.nameFull}` : `${SITE.nameFull} — Tufanganj, Cooch Behar`;
    document.title = full;
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", full);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:type"]', "property", "og:type", "website");
    setMeta('meta[property="og:image"]', "property", "og:image", `${SITE.url}/swami-dark.jpg`);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `${SITE.url}${path ?? window.location.pathname}`;
  }, [title, description, path]);
}
