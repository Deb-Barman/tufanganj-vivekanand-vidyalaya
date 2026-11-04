"""
Year-end promotion: move students up to the next class in a NEW academic session, in one safe, undoable step.

Rules
  * Only the students the Super Admin picks go up. Everyone else repeats: they move to the new session's version of the
    SAME class (classes are per session), so they are not left behind in last year's class.
  * Class 12 students are "passed out" (alumni): they keep their account, class, results, attendance and portfolio.
  * Nothing is deleted or rewritten: results, attendance, marksheets and homework stay tied to the old class/session, and
    every class year is kept in ClassEnrollment so the student can still open it.
  * Everything runs in one database transaction; a whole run can be undone while nothing has changed since.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .enrollment import move_student
from .models import AcademicSession, ClassEnrollment, Homework, Exam, PromotionBatch, Result, SchoolClass, StudentProfile, Subject, TimetableEntry

ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12}
ROMAN_BACK = {v: k.upper() for k, v in ROMAN.items()}
_NAME = re.compile(r"^\s*(?P<prefix>class|std|standard)?[\s.\-]*(?P<num>\d{1,2}|[ivx]{1,4})\s*$", re.I)
FINAL_LEVEL = 12
DEFAULT_STREAMS = ["Science", "Arts"]


@dataclass
class Level:
    number: int
    prefix: str  # "Class"
    roman: bool


def parse_level(name: str) -> Level | None:
    m = _NAME.match(name or "")
    if not m:
        return None
    raw = m.group("num").lower()
    num = int(raw) if raw.isdigit() else ROMAN.get(raw)
    if not num or not 1 <= num <= 14:
        return None
    return Level(num, (m.group("prefix") or "Class").capitalize() if m.group("prefix") else "Class", not raw.isdigit())


def name_for(level: Level, number: int) -> str:
    return f"{level.prefix} {ROMAN_BACK[number] if level.roman else number}"


def next_target(school_class: SchoolClass) -> dict:
    """Where the class goes next: {"name","stream","passes_out","needs_stream","known"}."""
    lv = parse_level(school_class.name)
    if lv is None:
        return {"name": "", "stream": school_class.stream, "passes_out": False, "needs_stream": False, "known": False}
    if lv.number >= FINAL_LEVEL:
        return {"name": "", "stream": school_class.stream, "passes_out": True, "needs_stream": False, "known": True}
    nxt = lv.number + 1
    # After Class 10 the student chooses Science or Arts; Class 11 → 12 keeps the stream.
    needs = nxt >= 11 and not school_class.stream
    return {"name": name_for(lv, nxt), "stream": school_class.stream, "passes_out": False, "needs_stream": needs, "known": True}


def suggest_session_label(current: AcademicSession | None) -> str:
    m = re.match(r"^\s*(\d{4})\s*[-–/]\s*(\d{4})\s*$", current.label if current else "")
    if m:
        a, b = int(m.group(1)) + 1, int(m.group(2)) + 1
        return f"{a}-{b}"
    y = timezone.localdate().year
    return f"{y}-{y + 1}"


def streams_in_use() -> list[str]:
    found = list(SchoolClass.objects.exclude(stream="").values_list("stream", flat=True).distinct())
    return sorted(set(found) | set(DEFAULT_STREAMS))


def build_plan(from_session: AcademicSession) -> dict:
    classes = []
    for c in SchoolClass.objects.filter(session=from_session).order_by("name", "stream"):
        students = (
            StudentProfile.objects.filter(school_class=c, is_alumni=False, user__is_active_account=True)
            .select_related("user")
            .order_by("roll_number", "user__full_name")
        )
        classes.append({
            "id": str(c.id),
            "label": str(c),
            "name": c.name,
            "stream": c.stream,
            "target": next_target(c),
            "students": [{"id": str(s.pk), "name": s.user.full_name, "username": s.user.username, "roll": s.roll_number} for s in students],
        })
    classes.sort(key=lambda x: (parse_level(x["name"]).number if parse_level(x["name"]) else 99, x["name"], x["stream"]))
    return {
        "from_session": {"id": str(from_session.id), "label": from_session.label},
        "suggested_label": suggest_session_label(from_session),
        "streams": streams_in_use(),
        "classes": classes,
    }


def _copy_class_setup(src: SchoolClass | None, dst: SchoolClass, copy_subjects: bool, copy_timetable: bool) -> None:
    """New year's class starts with last year's subjects (same teachers) and, if asked, the same weekly timetable."""
    if src is None:
        return
    mapping: dict = {}
    if copy_subjects:
        for sub in Subject.objects.filter(school_class=src):
            new = Subject.objects.create(name=sub.name, school_class=dst)
            mapping[sub.pk] = new
            teachers = list(sub.teachers.all())
            for t in teachers:
                t.subjects_taught.add(new)
    if copy_timetable:
        entries = []
        for e in TimetableEntry.objects.filter(school_class=src):
            entries.append(TimetableEntry(
                school_class=dst, weekday=e.weekday, period=e.period, start_time=e.start_time, end_time=e.end_time,
                subject=mapping.get(e.subject_id) if e.subject_id else None, label=e.label, teacher=e.teacher, room=e.room,
            ))
        TimetableEntry.objects.bulk_create(entries)


def _template_for(name: str, stream: str, new_session: AcademicSession, prefer: SchoolClass | None) -> SchoolClass | None:
    """The class to copy subjects/timetable from: the latest earlier version of the same class that has subjects."""
    qs = SchoolClass.objects.filter(name=name, stream=stream).exclude(session=new_session).order_by("-session__label")
    for c in qs:
        if c.subjects.exists():
            return c
    return prefer


@transaction.atomic
def apply_promotion(user, data: dict) -> PromotionBatch:
    label = str(data.get("to_session_label") or "").strip()
    if not label or len(label) > 20:
        raise ValidationError({"to_session_label": "Write the new session, like 2027-2028 (up to 20 characters)."})
    entries = data.get("classes")
    if not isinstance(entries, list) or not entries:
        raise ValidationError({"classes": "Choose at least one class."})
    make_current = bool(data.get("make_current", True))
    copy_subjects = bool(data.get("copy_subjects", True))
    copy_timetable = bool(data.get("copy_timetable", True)) and copy_subjects

    prior_current = AcademicSession.objects.filter(is_current=True).first()
    session, session_created = AcademicSession.objects.get_or_create(label=label, defaults={
        "start_date": data.get("start_date") or None,
        "working_days": data.get("working_days") or None,
        "attendance_min_percent": prior_current.attendance_min_percent if prior_current else 75,
    })

    class_cache: dict = {}
    created_class_ids: list = []
    moves: list = []
    counts = {"promoted": 0, "repeated": 0, "passed_out": 0}
    from_sessions = set()
    seen_students: set = set()

    def target_class(src: SchoolClass, name: str, stream: str) -> SchoolClass:
        key = (name, stream)
        if key in class_cache:
            return class_cache[key]
        cls, created = SchoolClass.objects.get_or_create(name=name, stream=stream, session=session)
        if created:
            created_class_ids.append(str(cls.id))
            _copy_class_setup(_template_for(name, stream, session, src if (name, stream) == (src.name, src.stream) else None), cls, copy_subjects, copy_timetable)
        class_cache[key] = cls
        return cls

    batch = PromotionBatch.objects.create(to_session=session, created_by=user)
    for entry in entries:
        try:
            src = SchoolClass.objects.select_related("session").get(pk=entry.get("class_id"))
        except (SchoolClass.DoesNotExist, ValueError, TypeError, Exception) as exc:  # noqa: BLE001 - bad id → friendly error
            raise ValidationError({"classes": "One of the classes was not found."}) from exc
        if src.session_id == session.id:
            raise ValidationError({"classes": f"{src} is already in {label}. Choose classes from the old session."})
        from_sessions.add(src.session_id)
        info = next_target(src)
        override = str(entry.get("target_name") or "").strip()
        for st in entry.get("students") or []:
            try:
                sp = StudentProfile.objects.select_related("user").get(pk=st.get("student_id"), school_class=src)
            except Exception as exc:  # noqa: BLE001
                raise ValidationError({"classes": f"A student does not belong to {src} (maybe already moved)."}) from exc
            if sp.pk in seen_students:
                continue
            seen_students.add(sp.pk)
            # Make sure last year's class is on record before the student moves (older rows may predate the history table).
            ClassEnrollment.objects.get_or_create(student=sp, school_class=src, defaults={"roll_number": sp.roll_number})
            action = st.get("action")
            if action == "promote":
                name = override or info["name"]
                if info["passes_out"] and not override:
                    raise ValidationError({"classes": f"{src} is the last class. Choose “passed out” or “stay” for {sp.user.full_name}."})
                if not name:
                    raise ValidationError({"classes": f"I do not know the class after “{src.name}”. Write its name for that class."})
                stream = src.stream
                if info["needs_stream"] and not override:
                    stream = str(st.get("stream") or "").strip()
                    if not stream:
                        raise ValidationError({"classes": f"Choose Science or Arts for {sp.user.full_name}."})
                tgt = target_class(src, name, stream[:20])
                outcome = "promoted"
            elif action == "repeat":
                tgt = target_class(src, src.name, src.stream)
                outcome = "repeated"
            elif action == "passed_out":
                if not info["passes_out"]:
                    raise ValidationError({"classes": f"Only the last class can pass out ({sp.user.full_name} is in {src})."})
                tgt, outcome = None, "passed_out"
            else:
                raise ValidationError({"classes": "Each student must be promote, stay or passed out."})

            if tgt is not None:
                move_student(sp, tgt, outcome, batch)
                StudentProfile.objects.filter(pk=sp.pk).update(school_class=tgt)
                counts["promoted" if outcome == "promoted" else "repeated"] += 1
                moves.append({"student": str(sp.pk), "from_class": str(src.id), "to_class": str(tgt.id), "outcome": outcome})
            else:
                ClassEnrollment.objects.filter(student=sp, school_class=src, ended_on__isnull=True).update(ended_on=timezone.localdate(), outcome="passed_out")
                StudentProfile.objects.filter(pk=sp.pk).update(is_alumni=True)
                counts["passed_out"] += 1
                moves.append({"student": str(sp.pk), "from_class": str(src.id), "to_class": None, "outcome": "passed_out"})

    if not moves:
        raise ValidationError({"classes": "No students were chosen."})
    if make_current:
        AcademicSession.objects.exclude(pk=session.pk).filter(is_current=True).update(is_current=False)
        session.is_current = True
        session.save(update_fields=["is_current"])
    batch.from_session = AcademicSession.objects.filter(pk__in=from_sessions).order_by("-label").first()
    batch.promoted, batch.repeated, batch.passed_out = counts["promoted"], counts["repeated"], counts["passed_out"]
    batch.detail = {
        "moves": moves,
        "created_class_ids": created_class_ids,
        "created_session": session_created,
        "previous_current_session": str(prior_current.id) if prior_current else None,
        "made_current": make_current,
        "to_session_label": label,
    }
    batch.save()
    return batch


def _class_is_unused(cls: SchoolClass) -> bool:
    return not (
        Result.objects.filter(subject__school_class=cls).exists()
        or Homework.objects.filter(school_class=cls).exists()
        or Exam.objects.filter(school_class=cls).exists()
        or StudentProfile.objects.filter(school_class=cls).exists()
    )


@transaction.atomic
def undo_promotion(batch: PromotionBatch) -> None:
    if batch.undone_at:
        raise ValidationError("This promotion was already undone.")
    newer = PromotionBatch.objects.filter(undone_at__isnull=True, created_at__gt=batch.created_at).exists()
    if newer:
        raise ValidationError("A newer promotion exists. Undo that one first.")
    moves = batch.detail.get("moves", [])
    for mv in moves:
        sp = StudentProfile.objects.filter(pk=mv["student"]).first()
        if sp is None:
            continue
        expected = mv["to_class"]
        if (str(sp.school_class_id) if sp.school_class_id else None) != (expected if expected else mv["from_class"]):
            raise ValidationError("Some students were changed after this promotion, so it cannot be undone safely.")
    for mv in moves:
        sp = StudentProfile.objects.filter(pk=mv["student"]).first()
        if sp is None:
            continue
        if mv["to_class"]:
            ClassEnrollment.objects.filter(student=sp, school_class_id=mv["to_class"], batch=batch).delete()
        ClassEnrollment.objects.filter(student=sp, school_class_id=mv["from_class"]).update(ended_on=None, outcome="")
        StudentProfile.objects.filter(pk=sp.pk).update(school_class_id=mv["from_class"], is_alumni=False)
    for cid in batch.detail.get("created_class_ids", []):
        cls = SchoolClass.objects.filter(pk=cid).first()
        if cls and _class_is_unused(cls):
            cls.delete()
    prev = batch.detail.get("previous_current_session")
    to_session = batch.to_session
    if batch.detail.get("made_current") and prev:
        AcademicSession.objects.filter(pk=prev).update(is_current=True)
        if to_session:
            AcademicSession.objects.filter(pk=to_session.pk).update(is_current=False)
    if to_session and batch.detail.get("created_session") and not to_session.classes.exists():
        to_session.delete()
    PromotionBatch.objects.filter(pk=batch.pk).update(undone_at=timezone.now())
