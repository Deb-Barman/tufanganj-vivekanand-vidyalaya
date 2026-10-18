"""
Profile pages: every signed-in user edits their own profile, and a student/teacher who switches it on gets a
public page at /profile/student/<username> or /profile/teacher/<username>.

Privacy rules enforced here (not in the browser):
  * the public API serialises ONLY the PublicProfile table + class/department name + full name — never phone,
    e-mail, guardian details, roll number, marks or attendance;
  * a profile is hidden until its owner opts in, a disabled account is hidden, and a missing/private/disabled
    profile all answer with the SAME 404, so the endpoint cannot be used to find out which usernames exist;
  * phone numbers and e-mail addresses typed into the text fields are refused (the page is public);
  * uploaded photos are re-encoded: metadata such as GPS location is stripped and the size is capped.
"""
import io
import re

from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from content.serializers import validate_image_upload
from notices.serializers import sanitize

from .models import PublicProfile, Role, User
from .permissions import IsAuthenticatedActiveUser

PUBLIC_ROLES = {"student": Role.STUDENT, "teacher": Role.TEACHER}
MAX_LIST_ITEMS = 12
MAX_ITEM_LEN = 40
PHOTO_MAX_SIDE = 800

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"(?:\+?\d[\s().-]?){9,}")  # 9+ digits in a row (spaces/dashes allowed) = looks like a phone number
NOT_FOUND = {"detail": "This profile does not exist or is private."}


def _public_text(value: str, label: str) -> str:
    value = sanitize((value or "").strip())
    if _EMAIL.search(value) or _PHONE.search(value):
        raise serializers.ValidationError(f"{label}: please remove phone numbers and e-mail addresses — this page is public.")
    return value


def _public_list(items, label: str):
    if not isinstance(items, list):
        raise serializers.ValidationError(f"{label} must be a list.")
    if len(items) > MAX_LIST_ITEMS:
        raise serializers.ValidationError(f"{label}: at most {MAX_LIST_ITEMS} items.")
    out, seen = [], set()
    for raw in items:
        if not isinstance(raw, str):
            raise serializers.ValidationError(f"{label} must contain text only.")
        item = _public_text(raw, label)
        if len(item) > MAX_ITEM_LEN:
            raise serializers.ValidationError(f"{label}: each item can be at most {MAX_ITEM_LEN} characters.")
        if item and item.lower() not in seen:
            seen.add(item.lower())
            out.append(item)
    return out


class MyProfileSerializer(serializers.ModelSerializer):
    """What the owner reads and edits (JSON). The photo has its own upload endpoint."""

    photo = serializers.ImageField(read_only=True)

    class Meta:
        model = PublicProfile
        fields = ["headline", "about", "background", "talents", "interests", "achievements", "website", "photo", "is_public", "updated_at"]
        read_only_fields = ["photo", "updated_at"]
        extra_kwargs = {"headline": {"max_length": 120}, "about": {"max_length": 1200}, "background": {"max_length": 1500}, "achievements": {"max_length": 1500}}

    def validate_headline(self, v):
        return _public_text(v, "Headline")

    def validate_about(self, v):
        return _public_text(v, "About")

    def validate_background(self, v):
        return _public_text(v, "Background")

    def validate_achievements(self, v):
        return _public_text(v, "Achievements")

    def validate_talents(self, v):
        return _public_list(v, "Talents")

    def validate_interests(self, v):
        return _public_list(v, "Interests")

    def validate_website(self, v):
        v = (v or "").strip()
        if v and not v.lower().startswith("https://"):
            raise serializers.ValidationError("Website must start with https://")
        return v


def _facts(user: User) -> dict:
    """Read-only facts shown next to the profile (taken from the school's records, not editable here)."""
    out = {"class_label": None, "department": None, "years_experience": None}
    if user.role == Role.STUDENT:
        sp = getattr(user, "student_profile", None)
        if sp and sp.school_class:
            out["class_label"] = str(sp.school_class)
    elif user.role == Role.TEACHER:
        tp = getattr(user, "teacher_profile", None)
        if tp:
            out["department"] = tp.department or None
            out["years_experience"] = tp.years_experience
    return out


def _public_path(user: User):
    role = {Role.STUDENT: "student", Role.TEACHER: "teacher"}.get(user.role)
    return f"/profile/{role}/{user.username}" if role else None


def _photo_url(profile, request):
    if not profile.photo:
        return None
    try:
        url = profile.photo.url
    except Exception:  # noqa: BLE001 - a storage hiccup must never break the whole profile
        return None
    return request.build_absolute_uri(url) if url.startswith("/") else url


class MyProfileView(APIView):
    """GET/PATCH /api/auth/me/profile/ — the signed-in user's own profile (all three roles)."""

    permission_classes = [IsAuthenticatedActiveUser]

    def _payload(self, request, profile):
        data = MyProfileSerializer(profile, context={"request": request}).data
        data["photo"] = _photo_url(profile, request)
        user = request.user
        return {
            **data,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "public_path": _public_path(user),  # None for the Super Admin: no public page for that account
            **_facts(user),
        }

    def get(self, request):
        profile, _ = PublicProfile.objects.get_or_create(user=request.user)
        return Response(self._payload(request, profile))

    def patch(self, request):
        profile, _ = PublicProfile.objects.get_or_create(user=request.user)
        ser = MyProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        if ser.validated_data.get("is_public") and not _public_path(request.user):
            raise serializers.ValidationError({"is_public": "This account type has no public page."})
        ser.save()
        profile.refresh_from_db()
        return Response(self._payload(request, profile))


class PhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField()

    def validate_photo(self, upload):
        validate_image_upload(upload)
        try:
            img = Image.open(upload)
            img.load()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
            raise serializers.ValidationError("This does not look like a real image.") from None
        img = ImageOps.exif_transpose(img).convert("RGB")  # honours phone rotation, drops all metadata
        img.thumbnail((PHOTO_MAX_SIDE, PHOTO_MAX_SIDE))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        return ContentFile(buf.getvalue(), name="photo.jpg")


class MyProfilePhotoView(APIView):
    """POST (multipart, field `photo`) replaces the photo; DELETE removes it."""

    permission_classes = [IsAuthenticatedActiveUser]

    @transaction.atomic
    def post(self, request):
        ser = PhotoUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        profile, _ = PublicProfile.objects.get_or_create(user=request.user)
        if profile.photo:
            profile.photo.delete(save=False)
        profile.photo = ser.validated_data["photo"]
        profile.save()
        return Response({"photo": _photo_url(profile, request)}, status=status.HTTP_200_OK)

    def delete(self, request):
        profile = PublicProfile.objects.filter(user=request.user).first()
        if profile and profile.photo:
            profile.photo.delete(save=False)
            profile.photo = None
            profile.save()
        return Response({"photo": None})


class PublicProfileView(APIView):
    """GET /api/auth/profiles/<student|teacher>/<username>/ — anyone, no sign-in."""

    permission_classes = [AllowAny]
    authentication_classes: list = []  # a public page never needs (or trusts) a token
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "profile_view"

    def get(self, request, role, username):
        wanted = PUBLIC_ROLES.get(role)
        user = (
            User.objects.filter(username=username, role=wanted, is_active_account=True, is_active=True)
            .select_related("public_profile", "student_profile__school_class", "teacher_profile")
            .first()
            if wanted
            else None
        )
        profile = getattr(user, "public_profile", None) if user else None
        if not profile or not profile.is_public:
            return Response(NOT_FOUND, status=status.HTTP_404_NOT_FOUND)
        resp = Response({
            "role": role,
            "username": user.username,
            "full_name": user.full_name,
            "headline": profile.headline,
            "about": profile.about,
            "background": profile.background,
            "talents": profile.talents or [],
            "interests": profile.interests or [],
            "achievements": profile.achievements,
            "website": profile.website,
            "photo": _photo_url(profile, request),
            "updated_at": profile.updated_at,
            **_facts(user),
        })
        resp["Cache-Control"] = "public, max-age=60"
        return resp
