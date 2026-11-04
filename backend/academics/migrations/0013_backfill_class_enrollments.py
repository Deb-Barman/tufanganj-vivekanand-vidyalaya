from django.db import migrations


def backfill(apps, schema_editor):
    """Every student who already has a class gets a 'current' history row, so nothing is lost on the first promotion."""
    StudentProfile = apps.get_model("academics", "StudentProfile")
    ClassEnrollment = apps.get_model("academics", "ClassEnrollment")
    rows = [
        ClassEnrollment(student_id=sp.pk, school_class_id=sp.school_class_id, roll_number=sp.roll_number or "")
        for sp in StudentProfile.objects.filter(school_class__isnull=False).only("pk", "school_class_id", "roll_number")
    ]
    ClassEnrollment.objects.bulk_create(rows, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [("academics", "0012_class_history_and_promotion")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
