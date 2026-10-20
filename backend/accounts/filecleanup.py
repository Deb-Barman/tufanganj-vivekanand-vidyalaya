"""
Delete a record -> delete its uploaded files too.

Without this, deleting a gallery photo, a download or a profile left the file behind in the storage bucket
(the school's free storage slowly filled with files nothing pointed to). One handler now covers every model of the
school's apps, whether the record is deleted from a page, the Data view or Django admin.
"""
import logging

from django.apps import apps
from django.db import transaction
from django.db.models import FileField
from django.db.models.signals import post_delete

logger = logging.getLogger(__name__)
APPS = ("accounts", "academics", "content", "notices")


def _remove(storage, name):
    try:
        storage.delete(name)
    except Exception:  # noqa: BLE001 - a storage hiccup must never break deleting the record
        logger.warning("could not delete stored file %s", name)


def _delete_files(sender, instance, **kwargs):
    for field in sender._meta.concrete_fields:
        if isinstance(field, FileField):
            name = getattr(instance, field.attname, None)
            name = getattr(name, "name", name)
            if name:
                # after the transaction commits, so a rolled-back delete never loses a file
                transaction.on_commit(lambda s=field.storage, n=name: _remove(s, n))


def connect():
    for label in APPS:
        try:
            models = apps.get_app_config(label).get_models()
        except LookupError:
            continue
        for model in models:
            if any(isinstance(f, FileField) for f in model._meta.concrete_fields):
                post_delete.connect(_delete_files, sender=model, dispatch_uid=f"filecleanup-{model._meta.label}")
