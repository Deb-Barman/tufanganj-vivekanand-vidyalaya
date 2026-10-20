/**
 * Paste-a-link helpers (the browser side of backend/content/links.py).
 * They give instant feedback and a live preview; the server re-checks every link before saving.
 */
export type LinkResult = { ok: true; url: string; note?: string } | { ok: false; error: string };

const GDRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com", "drive.usercontent.google.com"]);
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
const IMAGE_CDNS = ["googleusercontent.com", "i.imgur.com", "ibb.co", "postimg.cc", "cloudinary.com", "githubusercontent.com", "unsplash.com", "pexels.com", "wikimedia.org", "twimg.com", "fbcdn.net", "cdninstagram.com", "licdn.com", "ggpht.com", "ytimg.com", "staticflickr.com", "dropboxusercontent.com", "pinimg.com", "imgbb.com", "imagekit.io", "supabase.co"];
const SOCIAL_PAGES = ["facebook.com", "fb.com", "fb.watch", "instagram.com", "x.com", "twitter.com", "threads.net", "threads.com", "linkedin.com", "youtube.com", "youtu.be", "tiktok.com", "pinterest.com"];
const ID = "[A-Za-z0-9_-]{10,}";

const hostIs = (host: string, d: string) => host === d || host.endsWith("." + d);
const fail = (error: string): LinkResult => ({ ok: false, error });

function parse(input: string): { url: URL; host: string } | string {
  let v = input.trim();
  if (!v) return "Paste a link first.";
  if (v.length > 1000) return "That link is too long.";
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) return "Only https:// links are allowed.";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return "That does not look like a web link.";
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") return "The link must start with https:// (a secure link).";
  if (url.username || url.password || !host.includes(".") || /^[\d.]+$/.test(host) || host === "localhost") return "That does not look like a public web link.";
  return { url, host };
}

export function driveId(url: URL): string | null {
  for (const re of [new RegExp(`/file/d/(${ID})`), new RegExp(`/(?:document|spreadsheets|presentation|forms)/d/(${ID})`), new RegExp(`/d/(${ID})`)]) {
    const m = url.pathname.match(re);
    if (m) return m[1];
  }
  const id = url.searchParams.get("id");
  return id && new RegExp(`^${ID}$`).test(id) ? id : null;
}

export function normalizeImageLink(input: string): LinkResult {
  const p = parse(input);
  if (typeof p === "string") return fail(p);
  const { url, host } = p;
  if (GDRIVE_HOSTS.has(host)) {
    if (url.pathname.includes("/folders/") || (url.pathname.includes("/drive/") && !url.pathname.includes("/file/"))) return fail("That is a Google Drive folder. Open the picture itself, press Share → “Anyone with the link”, and copy that link.");
    const id = driveId(url);
    if (!id) return fail("Could not find a file in that Google link. In Drive: open the picture → Share → “Anyone with the link” → Copy link.");
    return { ok: true, url: `https://drive.google.com/thumbnail?id=${id}&sz=w1600`, note: "make sure sharing is set to “Anyone with the link”." };
  }
  if (hostIs(host, "dropbox.com") && !host.startsWith("dl.")) {
    const q = new URLSearchParams(url.search);
    q.delete("dl");
    q.delete("raw");
    q.set("raw", "1");
    return { ok: true, url: `https://${host}${url.pathname}?${q}` };
  }
  if (host === "imgur.com" || host === "www.imgur.com") {
    const m = url.pathname.match(/^\/([A-Za-z0-9]{5,8})$/);
    return m ? { ok: true, url: `https://i.imgur.com/${m[1]}.jpg` } : fail("That Imgur link is an album or gallery. Open one picture and copy its “Image address”.");
  }
  const isCdn = IMAGE_CDNS.some((c) => hostIs(host, c));
  if (SOCIAL_PAGES.some((d) => hostIs(host, d)) && !isCdn) return fail("That is a social media post/page, not a picture. Save the picture to Google Drive (Share → Anyone with the link) and paste that link — or open the picture alone and copy its “image address”.");
  if (IMAGE_EXT.test(url.pathname) || isCdn) {
    const social = ["twimg.com", "fbcdn.net", "cdninstagram.com", "licdn.com"].some((c) => hostIs(host, c));
    return { ok: true, url: `https://${host}${url.pathname}${url.search}`, note: social ? "Pictures copied from social sites can stop working after a while. For a permanent picture use Google Drive." : undefined };
  }
  return fail("That link is a web page, not a picture. Upload the picture to Google Drive (Share → Anyone with the link) and paste that link, or use a direct picture address ending in .jpg / .png / .webp.");
}

export function normalizeFileLink(input: string): LinkResult {
  const p = parse(input);
  if (typeof p === "string") return fail(p);
  const { url, host } = p;
  if (GDRIVE_HOSTS.has(host)) {
    const folder = url.pathname.match(new RegExp(`/folders/(${ID})`));
    if (folder) return { ok: true, url: `https://drive.google.com/drive/folders/${folder[1]}`, note: "folder — set sharing to “Anyone with the link”." };
    const id = driveId(url);
    if (!id) return fail("Could not find a file in that Google link. In Drive: open the file → Share → “Anyone with the link” → Copy link.");
    const kind = url.pathname.match(/\/(document|spreadsheets|presentation|forms)\/d\//);
    if (kind && host === "docs.google.com") return { ok: true, url: `https://docs.google.com/${kind[1]}/d/${id}/edit`, note: "Docs file — set sharing to “Anyone with the link”." };
    return { ok: true, url: `https://drive.google.com/file/d/${id}/view`, note: "set sharing to “Anyone with the link”." };
  }
  return { ok: true, url: `https://${host}${url.pathname}${url.search}` };
}

/** Which service a link belongs to, for a small label next to it. */
export function linkSource(link: string): string {
  try {
    const host = new URL(link).hostname.toLowerCase();
    if (hostIs(host, "google.com") || hostIs(host, "googleusercontent.com")) return "Google Drive";
    if (hostIs(host, "dropbox.com") || hostIs(host, "dropboxusercontent.com")) return "Dropbox";
    if (hostIs(host, "imgur.com")) return "Imgur";
    if (hostIs(host, "onedrive.live.com") || hostIs(host, "1drv.ms") || hostIs(host, "sharepoint.com")) return "OneDrive";
    return host.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

/** The sites a profile can link to (the logo, colour and a hint of what to type). Order = order on the page. */
export const SOCIAL_SITES = [
  { key: "instagram", label: "Instagram", hint: "@username" },
  { key: "facebook", label: "Facebook", hint: "username or profile link" },
  { key: "x", label: "X (Twitter)", hint: "@username" },
  { key: "youtube", label: "YouTube", hint: "@channel or link" },
  { key: "linkedin", label: "LinkedIn", hint: "profile link" },
  { key: "github", label: "GitHub", hint: "username" },
  { key: "telegram", label: "Telegram", hint: "@username" },
  { key: "threads", label: "Threads", hint: "@username" },
  { key: "pinterest", label: "Pinterest", hint: "username" },
  { key: "snapchat", label: "Snapchat", hint: "username" },
  { key: "behance", label: "Behance", hint: "username" },
  { key: "medium", label: "Medium", hint: "@username" },
  { key: "website", label: "Website", hint: "https://…" },
] as const;
export type SocialKey = (typeof SOCIAL_SITES)[number]["key"];
