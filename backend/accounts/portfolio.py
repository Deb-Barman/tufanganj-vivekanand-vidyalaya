"""
Portfolio pieces of a public student profile: the owner's section switches, and the two sections that come from the
SCHOOL's records instead of the student's own typing — results and attendance.

Privacy rules (enforced here, never in the browser):
  * results and attendance are OFF until the student switches them on, and the student can switch them off again;
  * "summary" results show percentages only; "full" results also show subject names and marks;
  * only the numbers of the student who owns the page are ever read, and never roll number, guardian, e-mail or phone;
  * the owner's switches decide what the API sends — a hidden section is simply absent from the response.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlparse, urlunparse

from django.utils import timezone

# section key -> shown by default?
SECTIONS = {
    "about": True,
    "quick_facts": True,
    "skills": True,  # skills, talents, interests, "currently learning"
    "projects": True,
    "achievements": True,
    "background": True,
    "social": True,
    "results": False,
    "attendance": False,  # attendance + homework habit ("discipline")
}
RESULTS_MODES = ("summary", "full")
ACHIEVEMENT_KINDS = ("award", "certificate", "competition", "activity", "other")


def effective_visibility(profile) -> dict:
    """Every section -> True/False, using the owner's choice or the default."""
    raw = profile.visibility if isinstance(profile.visibility, dict) else {}
    return {k: bool(raw.get(k, default)) for k, default in SECTIONS.items()}


_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?:\+?\d[\s().-]?){9,}")


def clean_https_link(value: str) -> str:
    """One https link (project page, GitHub repo, demo…). Raises ValueError with a friendly message."""
    v = (value or "").strip()
    if not v:
        return ""
    if _EMAIL.search(v) or _PHONE.search(v):
        raise ValueError("Please remove phone numbers and e-mail addresses.")
    if re.match(r"^[a-z][a-z0-9+.-]*:", v, re.I) and not v.lower().startswith(("https://", "http://")):
        raise ValueError("Only https:// links are allowed.")
    if not re.match(r"^https?://", v, re.I):
        v = "https://" + v
    p = urlparse(v)
    host = (p.hostname or "").lower()
    if p.scheme != "https" or p.username or p.password or "." not in host or re.fullmatch(r"[\d.]+", host) or len(v) > 300:
        raise ValueError("Use a full https:// link.")
    return urlunparse(("https", host, p.path or "/", "", p.query, ""))


# ───────────────────────────── results (from the school's records) ─────────────────────────────


def _half_up(x: float) -> int:
    """Round .5 UP, like the dashboard (JavaScript's Math.round) — Python's round() would give 82 for 82.5."""
    return int(x + 0.5)


def _pct(got, full) -> int:
    return _half_up(float(got) / float(full) * 100) if full else 0


def build_results(student_profile, mode: str) -> dict:
    """Class -> semesters -> subjects, from the marks the teachers entered. `mode` is "summary" or "full"."""
    from academics.models import Result

    full_mode = mode == "full"
    rows = list(Result.objects.filter(student=student_profile).select_related("subject__school_class__session", "session"))
    by_class: dict = defaultdict(lambda: defaultdict(list))
    class_obj: dict = {}
    for r in rows:
        c = r.subject.school_class
        class_obj[c.pk] = c
        by_class[c.pk][r.term].append(r)

    term_order = [t for t, _ in Result.Term.choices]
    term_label = dict(Result.Term.choices)
    classes, total_got, total_full = [], Decimal(0), Decimal(0)
    subject_totals: dict = defaultdict(lambda: [Decimal(0), Decimal(0)])
    for cid, terms in by_class.items():
        c = class_obj[cid]
        sems, c_got, c_full = [], Decimal(0), Decimal(0)
        for term in sorted(terms, key=lambda t: term_order.index(t) if t in term_order else 99):
            rs = terms[term]
            got = sum((r.marks_obtained for r in rs), Decimal(0))
            full = sum((r.full_marks for r in rs), Decimal(0))
            c_got, c_full = c_got + got, c_full + full
            sem = {"term": term, "label": term_label.get(term, term), "percent": _pct(got, full), "subject_count": len(rs)}
            if full_mode:
                sem["got"], sem["full"] = float(got), float(full)
                sem["subjects"] = sorted(
                    ({"name": r.subject.name, "got": float(r.marks_obtained), "full": float(r.full_marks), "percent": _pct(r.marks_obtained, r.full_marks)} for r in rs),
                    key=lambda x: x["name"].lower(),
                )
                for r in rs:
                    t = subject_totals[r.subject.name]
                    t[0] += r.marks_obtained
                    t[1] += r.full_marks
            sems.append(sem)
        total_got, total_full = total_got + c_got, total_full + c_full
        classes.append({
            "class_label": f"{c.name} {c.stream}".strip(),
            "session": c.session.label,
            "percent": _pct(c_got, c_full),
            "semesters": sems,
        })
    classes.sort(key=lambda x: (x["session"], x["class_label"]))
    out = {"mode": "full" if full_mode else "summary", "overall_percent": _pct(total_got, total_full), "classes": classes}
    if full_mode and subject_totals:
        ranked = sorted(((n, _pct(g, f)) for n, (g, f) in subject_totals.items()), key=lambda x: (-x[1], x[0].lower()))
        out["top_subjects"] = [{"name": n, "percent": p} for n, p in ranked[:3]]
    return out


# ───────────────────────────── attendance + homework habit ─────────────────────────────

WINDOW_DAYS = 365


def build_attendance(student_profile) -> dict:
    """The last 12 months of the student's attendance as a calendar, plus streaks and the homework habit."""
    from academics.models import Attendance, Homework, HomeworkCompletion

    today = timezone.localdate()
    start = today - timedelta(days=WINDOW_DAYS - 1)
    recs = list(Attendance.objects.filter(student=student_profile, date__gte=start, date__lte=today).order_by("date").values_list("date", "status"))
    days = [[d.isoformat(), "P" if s == "PRESENT" else "A"] for d, s in recs]
    present = sum(1 for _, s in recs if s == "PRESENT")
    total = len(recs)

    cur = best = run = 0
    for _, s in recs:
        run = run + 1 if s == "PRESENT" else 0
        best = max(best, run)
    cur = run  # the run that is still going at the latest marked day

    out = {
        "from": start.isoformat(),
        "to": today.isoformat(),
        "days": days,
        "present": present,
        "absent": total - present,
        "total": total,
        "percent": _half_up(present / total * 100) if total else None,
        "current_streak": cur,
        "longest_streak": best,
    }

    school_class = student_profile.school_class
    if school_class:
        due = Homework.objects.filter(school_class=school_class, due_date__gte=start, due_date__lt=today)
        total_hw = due.count()
        if total_hw:
            done = HomeworkCompletion.objects.filter(student=student_profile, homework__in=due).count()
            out["homework"] = {"done": done, "total": total_hw, "percent": _half_up(done / total_hw * 100)}
    return out
