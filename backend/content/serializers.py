from django.utils.text import slugify
from rest_framework import serializers

from notices.serializers import sanitize

from .models import Admission, Article, Event, GalleryImage, SchoolForm

MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_DOC_TYPES = {"application/pdf", "application/msword",
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}


def validate_image_upload(file):
    if file.size > MAX_IMAGE_SIZE:
        raise serializers.ValidationError("Image must be under 5 MB.")
    content_type = getattr(file, "content_type", None)
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise serializers.ValidationError("Only JPEG, PNG, or WebP images are allowed.")


# First bytes of the formats we accept: PDF, legacy .doc (OLE2), .docx (zip).
_DOC_SIGNATURES = (b"%PDF-", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", b"PK\x03\x04")


def validate_doc_upload(file):
    if file.size > MAX_DOC_SIZE:
        raise serializers.ValidationError("File must be under 10 MB.")
    content_type = getattr(file, "content_type", None)
    if content_type not in ALLOWED_DOC_TYPES:
        raise serializers.ValidationError("Only PDF or Word documents are allowed.")
    # The content type comes from the uploader's browser and can be faked, so
    # also check the file's real first bytes.
    head = file.read(8)
    file.seek(0)
    if not head.startswith(_DOC_SIGNATURES):
        raise serializers.ValidationError("This file does not look like a real PDF or Word document.")


class ArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Article
        fields = ["id", "title", "slug", "excerpt", "body", "cover_image", "published", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "slug", "created_by", "created_at", "updated_at"]

    def validate_title(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_excerpt(self, value):
        return sanitize(value.strip())

    def validate_body(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Body cannot be empty.")
        return value

    def validate_cover_image(self, value):
        if value:
            validate_image_upload(value)
        return value

    def create(self, validated_data):
        base_slug = slugify(validated_data["title"])[:200]
        slug = base_slug
        counter = 1
        while Article.objects.filter(slug=slug).exists():
            counter += 1
            slug = f"{base_slug}-{counter}"
        validated_data["slug"] = slug
        return super().create(validated_data)


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ["id", "title", "description", "event_date", "audience", "created_by", "created_at"]
        read_only_fields = ["id", "created_by", "created_at"]

    def validate_title(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_description(self, value):
        return sanitize(value.strip())


class GalleryImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = GalleryImage
        fields = ["id", "caption", "image", "uploaded_by", "created_at"]
        read_only_fields = ["id", "uploaded_by", "created_at"]

    def validate_image(self, value):
        validate_image_upload(value)
        return value

    def validate_caption(self, value):
        return sanitize(value.strip())


class SchoolFormSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolForm
        fields = ["id", "title", "file", "uploaded_by", "created_at"]
        read_only_fields = ["id", "uploaded_by", "created_at"]

    def validate_title(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_file(self, value):
        validate_doc_upload(value)
        return value


class AdmissionSerializer(serializers.ModelSerializer):
    """Public-facing: anyone can submit an enquiry, nobody can read it back except Super Admin."""

    class Meta:
        model = Admission
        fields = ["id", "applicant_name", "guardian_contact", "applying_for_class", "message", "status", "submitted_at"]
        read_only_fields = ["id", "status", "submitted_at"]

    def validate_applicant_name(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Applicant name is required.")
        return value

    def validate_guardian_contact(self, value):
        value = value.strip()
        digits = "".join(ch for ch in value if ch.isdigit())
        if len(digits) < 10:
            raise serializers.ValidationError("Enter a valid contact number.")
        return value

    def validate_message(self, value):
        return sanitize(value.strip())


class AdmissionAdminSerializer(AdmissionSerializer):
    """Super Admin view of an enquiry: identical, except `status` can be changed
    (the public submit serializer keeps it read-only so a visitor can't set it)."""

    class Meta(AdmissionSerializer.Meta):
        read_only_fields = ["id", "submitted_at"]
