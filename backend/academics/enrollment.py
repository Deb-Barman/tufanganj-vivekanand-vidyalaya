"""Keeps a student's class history (ClassEnrollment) in step with StudentProfile.school_class."""
from django.utils import timezone

from .models import ClassEnrollment


def move_student(student, new_class, outcome: str = "moved", batch=None):
    """
    Close the student's open enrollment with `outcome` and open one in `new_class` (None = no new class).
    Does not change StudentProfile.school_class — the caller does (so a bulk run can use one UPDATE).
    """
    today = timezone.localdate()
    ClassEnrollment.objects.filter(student=student, ended_on__isnull=True).exclude(school_class=new_class).update(ended_on=today, outcome=outcome)
    if new_class is not None:
        enr, created = ClassEnrollment.objects.get_or_create(
            student=student, school_class=new_class, defaults={"roll_number": student.roll_number, "batch": batch}
        )
        if not created and enr.ended_on:  # came back to a class they had before
            enr.ended_on, enr.outcome = None, ""
            enr.save(update_fields=["ended_on", "outcome"])
        return enr
    return None


def sync_current(student):
    """A student's class was changed some other way (Students page, bulk import): record it as history too."""
    if getattr(student, "is_alumni", False):  # passed out: the last class year stays as it was
        return
    open_rows = list(ClassEnrollment.objects.filter(student=student, ended_on__isnull=True))
    if student.school_class_id is None:
        if open_rows:
            move_student(student, None, "moved")
        return
    if any(r.school_class_id == student.school_class_id for r in open_rows):
        return
    move_student(student, student.school_class, "moved")


def class_ids_for(student_profile) -> set:
    """Every class this student has ever been in (current included) — what they may open in the portal."""
    ids = set(ClassEnrollment.objects.filter(student=student_profile).values_list("school_class_id", flat=True))
    if student_profile.school_class_id:
        ids.add(student_profile.school_class_id)
    return ids
