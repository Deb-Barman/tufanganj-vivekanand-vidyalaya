import uuid

from django.conf import settings
from django.db import models


class Notice(models.Model):
    """
    A school notice, visible to whichever audience it targets. Published by
    Super Admin (per context.md, Super Admin manages notices; Teachers can
    read but not publish in this first slice — extend to teacher-authored
    notices later if the school confirms that requirement).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    body = models.TextField()
    target_class = models.CharField(
        max_length=50,
        blank=True,
        help_text="Optional. e.g. 'Class 10'. Empty means visible to everyone.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="notices_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notices"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
