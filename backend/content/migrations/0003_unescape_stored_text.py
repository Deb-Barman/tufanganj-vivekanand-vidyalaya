"""
Data fix (see notices/0002): undo the "&amp;" / "&lt;" escaping the old
sanitiser stored in text fields so the website shows real characters.
"""
import html

from django.db import migrations

FIELDS = {
    "Article": ["title", "excerpt", "body"],
    "Event": ["title", "description"],
    "GalleryImage": ["caption"],
    "SchoolForm": ["title"],
    "Admission": ["applicant_name", "message"],
}


def unescape(apps, schema_editor):
    for model_name, fields in FIELDS.items():
        Model = apps.get_model("content", model_name)
        for obj in Model.objects.all():
            changed = []
            for f in fields:
                old = getattr(obj, f)
                new = html.unescape(old) if old else old
                if new != old:
                    setattr(obj, f, new)
                    changed.append(f)
            if changed:
                obj.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [("content", "0002_unicode_article_slug")]
    operations = [migrations.RunPython(unescape, migrations.RunPython.noop)]
