"""
Create the matching profile row whenever a Teacher/Student account is made.

Why: attendance, results and marksheets point at a StudentProfile, not at the
User. Accounts made from the portal's Accounts page (or Django admin) had no
profile, so the "Student" dropdown in Django admin's attendance form was empty
and nothing could be recorded. Doing it in a signal covers every way an
account can be created.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import Role, User

from .models import StudentProfile, TeacherProfile


@receiver(post_save, sender=User)
def ensure_role_profile(sender, instance, created, **kwargs):
    if instance.role == Role.STUDENT:
        StudentProfile.objects.get_or_create(user=instance)
    elif instance.role == Role.TEACHER:
        TeacherProfile.objects.get_or_create(user=instance)
