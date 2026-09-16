from rest_framework import serializers

from .models import Notice


class NoticeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default="")

    class Meta:
        model = Notice
        fields = [
            "id",
            "title",
            "body",
            "target_class",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Details cannot be empty.")
        return value
