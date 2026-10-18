from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("academics", "0009_teacher_attendance")]

    operations = [
        migrations.AddField(
            model_name="academicsession",
            name="start_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="academicsession",
            name="working_days",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="academicsession",
            name="attendance_min_percent",
            field=models.PositiveSmallIntegerField(default=75),
        ),
    ]
