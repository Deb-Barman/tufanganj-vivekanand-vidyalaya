"""
Data fix: the old sanitiser stored "&" as "&amp;" (and "<" as "&lt;"), which
then showed up literally on the website ("Science &amp; Arts"). Turn the
stored text back into real characters. The website renders these fields as
plain text, so this is safe.
"""
import html

from django.db import migrations


def unescape(apps, schema_editor):
    Notice = apps.get_model("notices", "Notice")
    for n in Notice.objects.all():
        new = (html.unescape(n.title), html.unescape(n.body), html.unescape(n.target_class))
        if new != (n.title, n.body, n.target_class):
            n.title, n.body, n.target_class = new
            n.save(update_fields=["title", "body", "target_class"])


class Migration(migrations.Migration):
    dependencies = [("notices", "0001_initial")]
    operations = [migrations.RunPython(unescape, migrations.RunPython.noop)]
