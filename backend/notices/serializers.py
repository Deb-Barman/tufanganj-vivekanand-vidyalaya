import html

import bleach
from rest_framework import serializers

from .models import Notice


def sanitize(value: str) -> str:
    """
    Strip every HTML tag and return PLAIN TEXT.

    The frontend renders all of these fields as text (React escapes them), so
    allowing <b>/<p> tags only made them show up literally on the page. The
    old version also left "&" stored as "&amp;", which then displayed as
    "&amp;" in titles such as "Science & Arts". Tags are removed here and the
    entities bleach produces are turned back into real characters.
    """
    cleaned = bleach.clean(value, tags=[], attributes={}, strip=True)
    return html.unescape(cleaned)


class NoticeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default="")

    class Meta:
        model = Notice
        fields = ["id", "title", "body", "target_class", "created_by", "created_by_name", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate_title(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_body(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Details cannot be empty.")
        return value

    def validate_target_class(self, value):
        return sanitize(value.strip())


class PublicNoticeSerializer(NoticeSerializer):
    """What the open website may see: no internal user IDs."""

    class Meta(NoticeSerializer.Meta):
        fields = ["id", "title", "body", "target_class", "created_by_name", "created_at", "updated_at"]
        read_only_fields = fields
