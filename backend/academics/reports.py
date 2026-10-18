"""
Attendance report for the Super Admin: how many days each student / teacher was present, as a percentage of
the days the school has held so far AND of the session's total working days (e.g. 200), plus a plain flag
for the people who need attention.

Read-only, Super-Admin-only, and built from a handful of grouped queries (never one query per person).
"""
import uuid

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User
from accounts.permissions import IsSuperAdmin

from .models import AcademicSession, Attendance, StudentProfile, TeacherAttendance

DEFAULT_MIN_PERCENT = 75
# Worst first, so the people who need attention are at the top of the list.
_ORDER = {"critical": 0, "low": 1, "no_data": 2, "ok": 3}


def _uuid_param(request, name):
    raw = (request.query_params.get(name) or "").strip()
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise ValidationError({name: "Not a valid ID."}) from None


def attendance_figures(present, absent, held_days, working_days, min_percent):
    """All the numbers for ONE person. Pure function so it is easy to test."""
    marked = present + absent
    pct = round(present / marked * 100, 1) if marked else None
    pct_total = round(min(present / working_days * 100, 100), 1) if working_days else None
    days_left = max(working_days - held_days, 0) if working_days else None
    best_possible = round(min((present + days_left) / working_days * 100, 100), 1) if working_days else None
    if marked == 0:
        status = "no_data"
    elif best_possible is not None and best_possible < min_percent:
        status = "critical"  # even with full attendance from now on, the minimum can no longer be reached
    elif pct < min_percent:
        status = "low"
    else:
        status = "ok"
    return {
        "present": present,
        "absent": absent,
        "marked": marked,
        "percent": pct,
        "percent_of_total": pct_total,
        "days_left": days_left,
        "best_possible_percent": best_possible,
        "status": status,
    }


class AttendanceReportView(APIView):
    """GET /api/academics/attendance-report/?kind=students|teachers&session=<id>&school_class=<id>"""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        kind = request.query_params.get("kind", "students")
        if kind not in ("students", "teachers"):
            raise ValidationError({"kind": "Use students or teachers."})

        session_id = _uuid_param(request, "session")
        class_id = _uuid_param(request, "school_class")
        session = (
            AcademicSession.objects.filter(pk=session_id).first() if session_id else AcademicSession.objects.filter(is_current=True).first()
        )
        if session_id and session is None:
            raise ValidationError({"session": "Session not found."})

        working_days = session.working_days if session else None
        min_percent = session.attendance_min_percent if session else DEFAULT_MIN_PERCENT
        today = timezone.localdate()
        start = session.start_date if session else None

        if kind == "students":
            people = StudentProfile.objects.filter(user__is_active_account=True).select_related("user", "school_class")
            if class_id:
                people = people.filter(school_class_id=class_id)
            records = Attendance.objects.filter(date__lte=today, student__in=people)
            key = "student_id"
        else:
            people = User.objects.filter(role=Role.TEACHER, is_active_account=True).select_related("teacher_profile")
            records = TeacherAttendance.objects.filter(date__lte=today, teacher__in=people)
            key = "teacher_id"
        if start:
            records = records.filter(date__gte=start)

        counts = {
            r[key]: r
            for r in records.values(key).annotate(
                present=Count("id", filter=Q(status="PRESENT")),
                absent=Count("id", filter=Q(status="ABSENT")),
            )
        }
        held_days = records.values("date").distinct().count()

        rows = []
        for p in people:
            c = counts.get(p.pk, {})
            fig = attendance_figures(c.get("present", 0), c.get("absent", 0), held_days, working_days, min_percent)
            if kind == "students":
                rows.append({
                    "id": str(p.pk), "name": p.user.full_name, "username": p.user.username,
                    "group": str(p.school_class) if p.school_class else "No class yet",
                    "roll_number": p.roll_number, **fig,
                })
            else:
                profile = getattr(p, "teacher_profile", None)
                rows.append({
                    "id": str(p.pk), "name": p.full_name, "username": p.username,
                    "group": (getattr(profile, "department", "") or "Teacher"),
                    "roll_number": "", **fig,
                })
        rows.sort(key=lambda r: (_ORDER[r["status"]], r["percent"] if r["percent"] is not None else 101, r["name"].lower()))

        with_data = [r["percent"] for r in rows if r["percent"] is not None]
        summary = {
            "people": len(rows),
            "average_percent": round(sum(with_data) / len(with_data), 1) if with_data else None,
            "ok": sum(r["status"] == "ok" for r in rows),
            "low": sum(r["status"] == "low" for r in rows),
            "critical": sum(r["status"] == "critical" for r in rows),
            "no_data": sum(r["status"] == "no_data" for r in rows),
            "days_held": held_days,
            "working_days": working_days,
            "days_left": max(working_days - held_days, 0) if working_days else None,
            "percent_of_session_done": round(min(held_days / working_days * 100, 100), 1) if working_days else None,
        }
        return Response({
            "kind": kind,
            "session": {
                "id": str(session.pk), "label": session.label, "working_days": working_days,
                "min_percent": min_percent, "start_date": str(start) if start else None,
            } if session else None,
            "summary": summary,
            "rows": rows,
        })
