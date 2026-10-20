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

from urllib.parse import urlparse, urlunparse

from content.links import LinkError, normalize_image_link
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


# platform -> (domains that count as that platform, how to build a link from just a @handle)
SOCIAL = {
    "instagram": (("instagram.com",), "https://www.instagram.com/{h}"),
    "facebook": (("facebook.com", "fb.com"), "https://www.facebook.com/{h}"),
    "x": (("x.com", "twitter.com"), "https://x.com/{h}"),
    "youtube": (("youtube.com", "youtu.be"), "https://www.youtube.com/@{h}"),
    "linkedin": (("linkedin.com",), "https://www.linkedin.com/in/{h}"),
    "github": (("github.com",), "https://github.com/{h}"),
    "telegram": (("t.me", "telegram.me"), "https://t.me/{h}"),
    "threads": (("threads.net", "threads.com"), "https://www.threads.net/@{h}"),
    "pinterest": (("pinterest.com",), "https://www.pinterest.com/{h}"),
    "snapchat": (("snapchat.com",), "https://www.snapchat.com/add/{h}"),
    "behance": (("behance.net",), "https://www.behance.net/{h}"),
    "medium": (("medium.com",), "https://medium.com/@{h}"),
    "website": ((), ""),
}
_HANDLE = re.compile(r"^[A-Za-z0-9._-]{1,60}$")
GENDERS = {"", "male", "female", "other"}


def normalize_social(platform: str, value: str) -> str:
    """A @handle or a link -> one clean https link on the right site. Raises ValueError with a friendly message."""
    domains, template = SOCIAL[platform]
    v = (value or "").strip()
    if not v:
        return ""
    if _EMAIL.search(v) or _PHONE.search(v):
        raise ValueError("Please remove phone numbers and e-mail addresses.")
    if template and _HANDLE.match(v.lstrip("@")):
        return template.format(h=v.lstrip("@"))
    if re.match(r"^[a-z][a-z0-9+.-]*:", v, re.I) and not v.lower().startswith(("https://", "http://")):
        raise ValueError("Only https:// links are allowed.")
    if not re.match(r"^https?://", v, re.I):
        v = "https://" + v
    p = urlparse(v)
    host = (p.hostname or "").lower()
    if p.scheme != "https" or p.username or p.password or "." not in host or re.fullmatch(r"[\d.]+", host) or len(v) > 300:
        raise ValueError("Use a full https:// link.")
    if domains and not any(host == d or host.endswith("." + d) for d in domains):
        raise ValueError(f"That does not look like a {platform.capitalize()} link ({domains[0]}).")
    # drop tracking junk (?igsh=…, ?utm_…) for profile links; keep the whole link for a personal website
    return urlunparse(("https", host, p.path.rstrip("/") or "/", "", p.query if platform == "website" else "", ""))


class MyProfileSerializer(serializers.ModelSerializer):
    """What the owner reads and edits (JSON). The photo has its own upload endpoint (or paste a link)."""

    photo = serializers.ImageField(read_only=True)
    photo_link = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    languages = serializers.ListField(child=serializers.CharField(max_length=MAX_ITEM_LEN), required=False, max_length=MAX_LIST_ITEMS)
    social_links = serializers.DictField(child=serializers.CharField(allow_blank=True, max_length=300), required=False)

    class Meta:
        model = PublicProfile
        fields = [
            "headline", "about", "background", "talents", "interests", "achievements", "website", "photo", "photo_link", "is_public", "updated_at",
            "age", "show_age", "gender", "show_gender", "city", "languages", "favorite_subject", "career_goal", "qualification", "quote", "projects", "social_links",
        ]
        read_only_fields = ["photo", "updated_at"]
        extra_kwargs = {
            "headline": {"max_length": 120}, "about": {"max_length": 1200}, "background": {"max_length": 1500}, "achievements": {"max_length": 1500}, "projects": {"max_length": 1500},
            "age": {"min_value": 4, "max_value": 100},
        }

    def validate_headline(self, v):
        return _public_text(v, "Headline")

    def validate_about(self, v):
        return _public_text(v, "About")

    def validate_background(self, v):
        return _public_text(v, "Background")

    def validate_achievements(self, v):
        return _public_text(v, "Achievements")

    def validate_projects(self, v):
        return _public_text(v, "Projects")

    def validate_talents(self, v):
        return _public_list(v, "Talents")

    def validate_interests(self, v):
        return _public_list(v, "Interests")

    def validate_languages(self, v):
        return _public_list(v, "Languages")

    def validate_city(self, v):
        return _public_text(v, "City")

    def validate_favorite_subject(self, v):
        return _public_text(v, "Favourite subject")

    def validate_career_goal(self, v):
        return _public_text(v, "Career goal")

    def validate_qualification(self, v):
        return _public_text(v, "Qualification")

    def validate_quote(self, v):
        return _public_text(v, "Quote")

    def validate_gender(self, v):
        v = (v or "").strip().lower()
        if v not in GENDERS:
            raise serializers.ValidationError("Choose male, female, other, or leave it empty.")
        return v

    def validate_website(self, v):
        v = (v or "").strip()
        if v and not v.lower().startswith("https://"):
            raise serializers.ValidationError("Website must start with https://")
        return v

    def validate_photo_link(self, v):
        v = (v or "").strip()
        if not v:
            return ""
        try:
            return normalize_image_link(v)
        except LinkError as exc:
            raise serializers.ValidationError(str(exc)) from None

    def validate_social_links(self, v):
        out = {}
        for platform, value in v.items():
            if platform not in SOCIAL:
                raise serializers.ValidationError(f"“{platform}” is not a supported site.")
            try:
                link = normalize_social(platform, value)
            except ValueError as exc:
                raise serializers.ValidationError(f"{platform.capitalize()}: {exc}") from None
            if link:
                out[platform] = link
        return out

    def update(self, instance, validated_data):
        link = validated_data.get("photo_link")
        if link and instance.photo:  # a pasted link replaces the uploaded photo, so its file is deleted
            instance.photo.delete(save=False)
            instance.photo = None
        return super().update(instance, validated_data)


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
    if profile.photo_link:
        return profile.photo_link
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
        data["photo_source"] = "link" if profile.photo_link else ("upload" if profile.photo else None)
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
        profile.photo_link = ""
        profile.save()
        return Response({"photo": _photo_url(profile, request)}, status=status.HTTP_200_OK)

    def delete(self, request):
        profile = PublicProfile.objects.filter(user=request.user).first()
        if profile and (profile.photo or profile.photo_link):
            if profile.photo:
                profile.photo.delete(save=False)
            profile.photo = None
            profile.photo_link = ""
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
            "city": profile.city,
            "languages": profile.languages or [],
            "favorite_subject": profile.favorite_subject,
            "career_goal": profile.career_goal,
            "qualification": profile.qualification,
            "quote": profile.quote,
            "projects": profile.projects,
            "social_links": profile.social_links or {},
            # age and gender are shown ONLY when the owner switched them on
            "age": profile.age if profile.show_age else None,
            "gender": profile.gender if profile.show_gender else "",
            **_facts(user),
        })
        resp["Cache-Control"] = "public, max-age=60"
        return resp
