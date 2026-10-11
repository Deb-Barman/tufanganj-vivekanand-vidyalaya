"""
Create the missing StudentProfile / TeacherProfile rows for accounts that were
made before academics/signals.py existed. Without a StudentProfile a student
cannot be picked in the attendance / results forms.
"""
from django.db import migrations


def backfill(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    StudentProfile = apps.get_model("academics", "StudentProfile")
    TeacherProfile = apps.get_model("academics", "TeacherProfile")
    for u in User.objects.filter(role="STUDENT"):
        StudentProfile.objects.get_or_create(user=u)
    for u in User.objects.filter(role="TEACHER"):
        TeacherProfile.objects.get_or_create(user=u)


class Migration(migrations.Migration):
    dependencies = [
        ("academics", "0005_alter_academicsession_options_and_more"),
        ("accounts", "0001_initial"),
    ]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
