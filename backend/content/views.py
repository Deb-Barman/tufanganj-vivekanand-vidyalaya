from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from accounts.permissions import IsSuperAdmin, IsSuperAdminOrReadOnly
from config.clientip import client_ip

from .models import Achievement, Admission, Article, ContactMessage, Event, GalleryImage, SchoolForm
from .serializers import (
    AchievementSerializer,
    ContactMessageAdminSerializer,
    ContactMessageSerializer,
    PublicAchievementSerializer,
    AdmissionAdminSerializer,
    AdmissionSerializer,
    ArticleSerializer,
    EventSerializer,
    GalleryImageSerializer,
    PublicArticleSerializer,
    PublicEventSerializer,
    PublicGalleryImageSerializer,
    PublicSchoolFormSerializer,
    SchoolFormSerializer,
)


# --- Articles / Blog -------------------------------------------------------

class PublicArticleListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicArticleSerializer
    queryset = Article.objects.filter(published=True)


class PublicArticleDetailView(generics.RetrieveAPIView):
    """A single published article by slug (slugs may contain Bengali letters)."""

    permission_classes = [AllowAny]
    serializer_class = PublicArticleSerializer
    queryset = Article.objects.filter(published=True)
    lookup_field = "slug"


class ArticleListCreateView(generics.ListCreateAPIView):
    """Super Admin sees drafts + published; write is Super-Admin-only."""

    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = ArticleSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated and self.request.user.is_super_admin:
            return Article.objects.all()
        return Article.objects.filter(published=True)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ArticleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = ArticleSerializer

    def get_queryset(self):
        # Same rule as the list view: drafts are visible to the Super Admin only.
        # (Without this, any signed-in user could read a draft by guessing its ID.)
        user = self.request.user
        if user.is_authenticated and user.is_super_admin:
            return Article.objects.all()
        return Article.objects.filter(published=True)


# --- Events -----------------------------------------------------------------

class PublicEventListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicEventSerializer
    queryset = Event.objects.all()


class EventListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = EventSerializer
    queryset = Event.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class EventDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = EventSerializer
    queryset = Event.objects.all()


# --- Gallery ------------------------------------------------------------

class PublicGalleryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicGalleryImageSerializer
    queryset = GalleryImage.objects.all()


class GalleryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = GalleryImageSerializer
    queryset = GalleryImage.objects.all()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class GalleryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = GalleryImageSerializer
    queryset = GalleryImage.objects.all()


# --- School Forms / Downloads ---------------------------------------------

class PublicSchoolFormListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicSchoolFormSerializer
    queryset = SchoolForm.objects.all()


class SchoolFormListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = SchoolFormSerializer
    queryset = SchoolForm.objects.all()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class SchoolFormDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = SchoolFormSerializer
    queryset = SchoolForm.objects.all()


# --- Admissions --------------------------------------------------------

class AdmissionRateThrottle(AnonRateThrottle):
    """Deliberately tighter than the global anon default — this is a public
    write endpoint with no auth at all, the highest-risk surface in the API."""

    scope = "admission_submit"


class AdmissionCreateView(generics.CreateAPIView):
    """Public: anyone can submit an enquiry. Nobody can read it back except Super Admin (see AdmissionListView)."""

    permission_classes = [AllowAny]
    serializer_class = AdmissionSerializer
    throttle_classes = [AdmissionRateThrottle]

    def perform_create(self, serializer):
        # Resolved by DRF so it honours NUM_PROXIES (see settings.py), then reduced
        # to ONE valid address: PostgreSQL rejects a comma-joined X-Forwarded-For.
        ip = client_ip(self.request)
        # Coarse additional guard beyond DRF throttling: block a contact
        # number that has already submitted 3+ enquiries in the last 24h,
        # even from a different IP (DRF throttling alone is IP-scoped).
        contact = serializer.validated_data.get("guardian_contact")
        recent_count = Admission.objects.filter(
            guardian_contact=contact,
            submitted_at__gte=timezone.now() - timedelta(hours=24),
        ).count()
        if recent_count >= 3:
            from rest_framework.exceptions import Throttled
            raise Throttled(detail="Too many enquiries submitted with this contact number recently.")
        serializer.save(submitted_from_ip=ip)


class AdmissionListView(generics.ListAPIView):
    """Super-Admin-only: review submitted enquiries."""

    permission_classes = [IsSuperAdmin]
    serializer_class = AdmissionSerializer
    queryset = Admission.objects.all()


class AdmissionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AdmissionAdminSerializer
    queryset = Admission.objects.all()


# --- Contact messages ------------------------------------------------------

class ContactRateThrottle(AnonRateThrottle):
    scope = "contact_submit"


class ContactCreateView(generics.CreateAPIView):
    """Public: anyone can send a message; only the Super Admin can read it."""

    permission_classes = [AllowAny]
    serializer_class = ContactMessageSerializer
    throttle_classes = [ContactRateThrottle]

    def perform_create(self, serializer):
        ip = client_ip(self.request)
        # Same idea as admissions: also cap per sender, so rotating IPs doesn't help a spammer.
        sender = serializer.validated_data.get("email") or serializer.validated_data.get("phone")
        key = {"email": sender} if serializer.validated_data.get("email") else {"phone": sender}
        if ContactMessage.objects.filter(created_at__gte=timezone.now() - timedelta(hours=24), **key).count() >= 5:
            from rest_framework.exceptions import Throttled

            raise Throttled(detail="Too many messages sent from this contact recently. Please try again tomorrow.")
        serializer.save(submitted_from_ip=ip)


class ContactListView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = ContactMessageAdminSerializer
    queryset = ContactMessage.objects.all()


class ContactDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = ContactMessageAdminSerializer
    queryset = ContactMessage.objects.all()


# --- Achievements ----------------------------------------------------------

class PublicAchievementListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicAchievementSerializer
    queryset = Achievement.objects.all()


class AchievementListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AchievementSerializer
    queryset = Achievement.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class AchievementDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AchievementSerializer
    queryset = Achievement.objects.all()
