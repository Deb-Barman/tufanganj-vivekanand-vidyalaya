import bleach
from rest_framework import serializers

from .models import Notice

# Notices/articles bodies allow minimal safe formatting only. Anything else
# is stripped server-side — never trust that the frontend won't send raw
# HTML/script content, since context.md requires XSS protection and the
# request could come from anywhere, not just our own frontend.
ALLOWED_TAGS = ["b", "i", "em", "strong", "p", "br", "ul", "ol", "li"]


def sanitize(value: str) -> str:
    return bleach.clean(value, tags=ALLOWED_TAGS, strip=True)


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
