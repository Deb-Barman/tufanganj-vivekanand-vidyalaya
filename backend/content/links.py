"""
Paste-a-link instead of uploading.

The school's free storage is small, so images and files can now be a PUBLIC LINK (Google Drive "Anyone with the
link", Dropbox, Imgur, …) instead of an upload. These helpers check a pasted link and turn it into one that works
directly: a picture link that a web page can show, or a file link that opens/downloads.

The server never downloads anything from these links (so there is nothing to abuse); the visitor's browser loads
them. Only https links are accepted — never javascript:, data:, file: or plain http.
"""
import re
from urllib.parse import parse_qs, urlparse, urlunparse

MAX_LINK = 1000


class LinkError(ValueError):
    """The message is written for the person who pasted the link."""


_GDRIVE_HOSTS = {"drive.google.com", "docs.google.com", "drive.usercontent.google.com"}
_IMAGE_EXT = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp")
# Sites whose links are pictures even without a file ending (their own image servers).
_IMAGE_CDNS = (
    "googleusercontent.com", "i.imgur.com", "ibb.co", "postimg.cc", "cloudinary.com", "githubusercontent.com", "unsplash.com",
    "pexels.com", "wikimedia.org", "twimg.com", "fbcdn.net", "cdninstagram.com", "licdn.com", "ggpht.com", "ytimg.com",
    "staticflickr.com", "dropboxusercontent.com", "pinimg.com", "imgbb.com", "imagekit.io", "supabase.co",
)
# Pages (not pictures) on social sites.
_SOCIAL_PAGES = ("facebook.com", "fb.com", "fb.watch", "instagram.com", "x.com", "twitter.com", "threads.net", "threads.com", "linkedin.com", "youtube.com", "youtu.be", "tiktok.com", "pinterest.com")
_ID = r"[A-Za-z0-9_-]{10,}"


def _host_is(host, domain):
    return host == domain or host.endswith("." + domain)


def _clean(url: str):
    url = (url or "").strip()
    if not url:
        raise LinkError("Paste a link first.")
    if len(url) > MAX_LINK:
        raise LinkError("That link is too long.")
    if re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I) and not url.lower().startswith(("https://", "http://")):
        raise LinkError("Only https:// links are allowed.")
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url  # "drive.google.com/…" pasted without the beginning
    p = urlparse(url)
    if p.scheme.lower() != "https":
        raise LinkError("The link must start with https:// (a secure link).")
    host = (p.hostname or "").lower()
    if p.username or p.password or "." not in host or re.fullmatch(r"[\d.]+", host) or host == "localhost":
        raise LinkError("That does not look like a public web link.")
    return p, host


def gdrive_id(p):
    """The file id inside any Google Drive / Docs link, or None."""
    for pat in (rf"/file/d/({_ID})", rf"/(?:document|spreadsheets|presentation|forms)/d/({_ID})", rf"/d/({_ID})"):
        m = re.search(pat, p.path)
        if m:
            return m.group(1)
    ids = parse_qs(p.query).get("id")
    return ids[0] if ids and re.fullmatch(_ID, ids[0]) else None


def normalize_image_link(url: str) -> str:
    """Return a link that shows the PICTURE directly, or raise LinkError saying what to do instead."""
    p, host = _clean(url)
    if host in _GDRIVE_HOSTS:
        if "/folders/" in p.path or "/drive/" in p.path and "/file/" not in p.path:
            raise LinkError("That is a Google Drive folder. Open the picture itself, press Share → “Anyone with the link”, and copy that link.")
        fid = gdrive_id(p)
        if not fid:
            raise LinkError("Could not find a file in that Google link. In Drive: open the picture → Share → “Anyone with the link” → Copy link.")
        return f"https://drive.google.com/thumbnail?id={fid}&sz=w1600"
    if _host_is(host, "dropbox.com") and not host.startswith("dl."):
        q = {k: v for k, v in parse_qs(p.query).items() if k not in ("dl", "raw")}
        pairs = "&".join(f"{k}={v[0]}" for k, v in q.items())
        return urlunparse(("https", host, p.path, "", (pairs + "&" if pairs else "") + "raw=1", ""))
    if host == "imgur.com" or host == "www.imgur.com":
        m = re.fullmatch(r"/([A-Za-z0-9]{5,8})", p.path)
        if not m:
            raise LinkError("That Imgur link is an album or gallery. Open one picture and copy its “Image address”.")
        return f"https://i.imgur.com/{m.group(1)}.jpg"
    if any(_host_is(host, d) for d in _SOCIAL_PAGES) and not any(_host_is(host, c) for c in _IMAGE_CDNS):
        raise LinkError(
            "That is a social media post/page, not a picture. Save the picture to Google Drive (Share → Anyone with the link) and paste "
            "that link — or open the picture alone and copy its “image address”."
        )
    if p.path.lower().endswith(_IMAGE_EXT) or any(_host_is(host, c) for c in _IMAGE_CDNS):
        return urlunparse(("https", host, p.path, "", p.query, ""))
    raise LinkError(
        "That link is a web page, not a picture. Upload the picture to Google Drive (Share → Anyone with the link) and paste that link, "
        "or use a direct picture address that ends in .jpg / .png / .webp."
    )


def normalize_file_link(url: str) -> str:
    """Return a clean link to a file/folder (Google Drive, Dropbox, OneDrive, …) that opens for anyone."""
    p, host = _clean(url)
    if host in _GDRIVE_HOSTS:
        if "/folders/" in p.path:
            m = re.search(rf"/folders/({_ID})", p.path)
            if m:
                return f"https://drive.google.com/drive/folders/{m.group(1)}"
        fid = gdrive_id(p)
        if not fid:
            raise LinkError("Could not find a file in that Google link. In Drive: open the file → Share → “Anyone with the link” → Copy link.")
        kind = re.search(r"/(document|spreadsheets|presentation|forms)/d/", p.path)
        if kind and host == "docs.google.com":
            return f"https://docs.google.com/{kind.group(1)}/d/{fid}/edit"
        return f"https://drive.google.com/file/d/{fid}/view"
    return urlunparse(("https", host, p.path, "", p.query, ""))


def drive_download_url(link: str):
    """For a Drive file link, the direct-download address (None for anything else)."""
    m = re.search(rf"drive\.google\.com/file/d/({_ID})", link or "")
    return f"https://drive.google.com/uc?export=download&id={m.group(1)}" if m else None
