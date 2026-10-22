"""
Picture "adjust" value: where the picture sits inside its frame (like moving/zooming a photo in Instagram).

Stored as a short string "x,y,zoom":
  x, y  = focus point in percent (0 = left/top edge, 50 = centre, 100 = right/bottom edge)
  zoom  = 1 (fit the frame) up to 4

The original picture is never cut: the website only changes how it is shown, so this works the same for uploaded
pictures and pasted links (Google Drive, Imgur, ...). An empty string means "centred, no zoom".
"""
import re

_PART = r"(\d{1,3}(?:\.\d{1,2})?)"
_RE = re.compile(rf"^\s*{_PART}\s*,\s*{_PART}\s*,\s*(\d(?:\.\d{{1,2}})?)\s*$")
MAX_ZOOM = 4.0


def clean_adjust(value) -> str:
    """Return the normalised "x,y,zoom" string, or "" for the default. Raises ValueError for anything odd."""
    text = (value or "").strip() if isinstance(value, str) else ""
    if value not in (None, "") and not isinstance(value, str):
        raise ValueError("Picture position must be text like 50,50,1.")
    if not text:
        return ""
    m = _RE.match(text)
    if not m:
        raise ValueError("Picture position must look like 50,50,1 (x %, y %, zoom).")
    x, y, z = (float(g) for g in m.groups())
    if not (0 <= x <= 100 and 0 <= y <= 100):
        raise ValueError("Picture position must stay between 0 and 100 %.")
    if not (1 <= z <= MAX_ZOOM):
        raise ValueError(f"Zoom must be between 1 and {MAX_ZOOM:g}.")
    if (x, y, z) == (50.0, 50.0, 1.0):
        return ""
    return f"{x:g},{y:g},{z:g}"
