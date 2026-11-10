from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from notices.serializers import sanitize

from .adjust import clean_adjust
from .links import LinkError, drive_download_url, normalize_file_link, normalize_image_link
from .models import Achievement, AppRelease, ContactMessage, Admission, Article, Event, GalleryImage, SchoolForm

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


def validate_adjust_value(value):
    """Shared check for the picture position ("x,y,zoom") fields."""
    try:
        return clean_adjust(value)
    except ValueError as exc:
        raise serializers.ValidationError(str(exc)) from None


class LinkOrUploadMixin:
    """
    An image/file can be UPLOADED or a pasted public LINK (Google Drive "Anyone with the link", Imgur, …).
    Pasting a link keeps the free storage empty. The API still returns the usual field (`image`, `cover_image`,
    `file`) holding the address to show — the upload's URL or the link — so pages need no changes — plus `source`
    ("upload" / "link").
    """

    upload_field = ""
    link_field = ""
    link_kind = "image"  # "image" or "file"
    media_required = False
    adjust_field = ""  # optional "x,y,zoom" field; reset when the picture itself is replaced

    def _normalize(self, link):
        try:
            return (normalize_image_link if self.link_kind == "image" else normalize_file_link)(link)
        except LinkError as exc:
            raise serializers.ValidationError({self.link_field: str(exc)}) from None

    def validate(self, attrs):
        attrs = super().validate(attrs)
        up, ln = self.upload_field, self.link_field
        new_link = attrs.get(ln)
        if new_link is not None:
            new_link = new_link.strip()
            attrs[ln] = self._normalize(new_link) if new_link else ""
        new_upload = attrs.get(up)
        if new_upload and attrs.get(ln):
            raise serializers.ValidationError("Choose either an upload or a link, not both.")
        if attrs.get(ln):
            attrs[up] = None  # a link replaces any earlier upload (its file is deleted after saving)
        elif new_upload:
            attrs[ln] = ""
        if self.adjust_field and (new_upload or attrs.get(ln)) and self.adjust_field not in attrs:
            attrs[self.adjust_field] = ""  # a different picture starts centred, not with the old picture's position
        if self.media_required:
            inst = self.instance
            keeps_upload = inst is not None and bool(getattr(inst, up)) and up not in attrs
            keeps_link = inst is not None and bool(getattr(inst, ln)) and ln not in attrs
            if not (attrs.get(up) or attrs.get(ln) or keeps_upload or keeps_link):
                what = "a picture" if self.link_kind == "image" else "a file"
                raise serializers.ValidationError({ln: f"Upload {what} or paste a link."})
        return attrs

    def update(self, instance, validated_data):
        old = getattr(instance, self.upload_field)
        old_name, storage = (old.name, old.storage) if old else (None, None)
        instance = super().update(instance, validated_data)
        now = getattr(instance, self.upload_field)
        if old_name and (not now or now.name != old_name):
            transaction.on_commit(lambda: storage.delete(old_name))
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        link = getattr(instance, self.link_field, "") or ""
        if link:
            data[self.upload_field] = link
        data["source"] = "link" if link else ("upload" if data.get(self.upload_field) else None)
        if self.link_kind == "file":
            data["download_url"] = drive_download_url(link) if link else None
        return data


class ArticleSerializer(LinkOrUploadMixin, serializers.ModelSerializer):
    upload_field, link_field, adjust_field = "cover_image", "cover_link", "cover_adjust"
    cover_link = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    cover_adjust = serializers.CharField(required=False, allow_blank=True, max_length=24)

    class Meta:
        model = Article
        fields = ["id", "title", "slug", "excerpt", "body", "cover_image", "cover_link", "cover_adjust", "published", "created_by", "created_at", "updated_at"]
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

    def validate_cover_adjust(self, value):
        return validate_adjust_value(value)

    def create(self, validated_data):
        # allow_unicode keeps Bengali titles readable; the fallback stops a
        # title with no letters/digits from producing an empty slug.
        base_slug = (slugify(validated_data["title"], allow_unicode=True)[:200]) or "article"
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


class GalleryImageSerializer(LinkOrUploadMixin, serializers.ModelSerializer):
    upload_field, link_field, media_required = "image", "image_link", True
    adjust_field = "image_adjust"
    image_link = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    image_adjust = serializers.CharField(required=False, allow_blank=True, max_length=24)

    class Meta:
        model = GalleryImage
        fields = ["id", "caption", "image", "image_link", "image_adjust", "uploaded_by", "created_at"]
        read_only_fields = ["id", "uploaded_by", "created_at"]

    def validate_image(self, value):
        if value:
            validate_image_upload(value)
        return value

    def validate_image_adjust(self, value):
        return validate_adjust_value(value)

    def validate_caption(self, value):
        return sanitize(value.strip())


class SchoolFormSerializer(LinkOrUploadMixin, serializers.ModelSerializer):
    upload_field, link_field, link_kind, media_required = "file", "file_link", "file", True
    file_link = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    class Meta:
        model = SchoolForm
        fields = ["id", "title", "file", "file_link", "uploaded_by", "created_at"]
        read_only_fields = ["id", "uploaded_by", "created_at"]

    def validate_title(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_file(self, value):
        if value:
            validate_doc_upload(value)
        return value


class AppReleaseSerializer(serializers.ModelSerializer):
    """The Super Admin's view of an app download. `download_link` is a pasted public link (Drive, GitHub, store page…)."""

    platform_label = serializers.CharField(source="get_platform_display", read_only=True)
    download_url = serializers.SerializerMethodField()
    download_link = serializers.CharField(max_length=1000)

    class Meta:
        model = AppRelease
        fields = ["id", "name", "platform", "platform_label", "version", "size_text", "notes", "download_link", "download_url", "is_published", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def get_download_url(self, obj):
        """Direct-download address for Google Drive files (None for anything else)."""
        return drive_download_url(obj.download_link)

    def validate_name(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Give the app a name.")
        return value

    def validate_version(self, value):
        return sanitize(value.strip())

    def validate_size_text(self, value):
        return sanitize(value.strip())

    def validate_notes(self, value):
        return sanitize(value.strip())

    def validate_download_link(self, value):
        try:
            return normalize_file_link(value)
        except LinkError as exc:
            raise serializers.ValidationError(str(exc)) from None


class PublicAppReleaseSerializer(AppReleaseSerializer):
    """What visitors see: no internal user ids, no hidden fields."""

    class Meta(AppReleaseSerializer.Meta):
        fields = ["id", "name", "platform", "platform_label", "version", "size_text", "notes", "download_link", "download_url", "updated_at"]
        read_only_fields = fields


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


# --- Public (open-website) versions: no internal user IDs are exposed ----------

class PublicArticleSerializer(ArticleSerializer):
    class Meta(ArticleSerializer.Meta):
        fields = ["id", "title", "slug", "excerpt", "body", "cover_image", "cover_adjust", "created_at", "updated_at"]
        read_only_fields = fields


class PublicEventSerializer(EventSerializer):
    class Meta(EventSerializer.Meta):
        fields = ["id", "title", "description", "event_date", "audience", "created_at"]
        read_only_fields = fields


class PublicGalleryImageSerializer(GalleryImageSerializer):
    class Meta(GalleryImageSerializer.Meta):
        fields = ["id", "caption", "image", "image_adjust", "created_at"]
        read_only_fields = fields


class PublicSchoolFormSerializer(SchoolFormSerializer):
    class Meta(SchoolFormSerializer.Meta):
        fields = ["id", "title", "file", "created_at"]
        read_only_fields = fields


class ContactMessageSerializer(serializers.ModelSerializer):
    """Public submit: nobody can read a message back, and `status` can't be set by the sender."""

    class Meta:
        model = ContactMessage
        fields = ["id", "name", "email", "phone", "subject", "message", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_name(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Please enter your name.")
        return value

    def validate_subject(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Please enter a subject.")
        return value

    def validate_message(self, value):
        value = sanitize(value.strip())
        if len(value) < 10:
            raise serializers.ValidationError("Please write at least a short sentence (10 characters).")
        return value

    def validate_phone(self, value):
        value = value.strip()
        if value and len("".join(ch for ch in value if ch.isdigit())) < 10:
            raise serializers.ValidationError("Enter a valid phone number or leave it empty.")
        return value

    def validate(self, attrs):
        email = attrs.get("email", getattr(self.instance, "email", ""))
        phone = attrs.get("phone", getattr(self.instance, "phone", ""))
        if not email and not phone:
            raise serializers.ValidationError("Please give an email address or a phone number so we can reply.")
        return attrs


class ContactMessageAdminSerializer(ContactMessageSerializer):
    class Meta(ContactMessageSerializer.Meta):
        read_only_fields = ["id", "created_at"]


class AchievementSerializer(LinkOrUploadMixin, serializers.ModelSerializer):
    upload_field, link_field = "image", "image_link"
    adjust_field = "image_adjust"
    image_link = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    image_adjust = serializers.CharField(required=False, allow_blank=True, max_length=24)

    class Meta:
        model = Achievement
        fields = ["id", "title", "description", "year", "category", "image", "image_link", "image_adjust", "created_by", "created_at"]
        read_only_fields = ["id", "created_by", "created_at"]

    def validate_title(self, value):
        value = sanitize(value.strip())
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_description(self, value):
        return sanitize(value.strip())

    def validate_year(self, value):
        from django.utils import timezone

        if not 1964 <= value <= timezone.now().year + 1:
            raise serializers.ValidationError("Enter a realistic year.")
        return value

    def validate_image(self, file):
        if file:
            validate_image_upload(file)
        return file

    def validate_image_adjust(self, value):
        return validate_adjust_value(value)


class PublicAchievementSerializer(AchievementSerializer):
    class Meta(AchievementSerializer.Meta):
        fields = ["id", "title", "description", "year", "category", "image", "image_adjust"]
        read_only_fields = fields
