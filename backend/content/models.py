import uuid

from django.conf import settings
from django.db import models


def article_cover_path(instance, filename):
    return f"article-covers/{instance.id}/{filename}"


def gallery_path(instance, filename):
    return f"gallery/{instance.id}/{filename}"


def achievement_path(instance, filename):
    return f"achievements/{instance.id}/{filename}"


def school_form_path(instance, filename):
    return f"school-forms/{instance.id}/{filename}"


class Article(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, allow_unicode=True)
    excerpt = models.CharField(max_length=300, blank=True)
    body = models.TextField()
    cover_image = models.ImageField(upload_to=article_cover_path, blank=True, null=True)
    #: Instead of uploading: a public picture link (Google Drive "Anyone with the link", Imgur, …). Saves storage.
    cover_link = models.URLField(max_length=1000, blank=True)
    published = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "articles"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    event_date = models.DateField()
    audience = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "events"
        ordering = ["event_date"]

    def __str__(self):
        return self.title


class GalleryImage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caption = models.CharField(max_length=200, blank=True)
    image = models.ImageField(upload_to=gallery_path, blank=True, null=True)
    image_link = models.URLField(max_length=1000, blank=True)  # public picture link used instead of an upload
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gallery_images"
        ordering = ["-created_at"]


class SchoolForm(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to=school_form_path, blank=True, null=True)
    file_link = models.URLField(max_length=1000, blank=True)  # public file link (Google Drive, …) used instead of an upload
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "school_forms"
        ordering = ["-created_at"]


class Admission(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONTACTED = "CONTACTED", "Contacted"
        CLOSED = "CLOSED", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    applicant_name = models.CharField(max_length=150)
    guardian_contact = models.CharField(max_length=20)
    applying_for_class = models.CharField(max_length=50)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    submitted_at = models.DateTimeField(auto_now_add=True)
    submitted_from_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "admissions"
        ordering = ["-submitted_at"]


class ContactMessage(models.Model):
    """A message sent from the public Contact page. Only the Super Admin can read it."""

    class Status(models.TextChoices):
        NEW = "NEW", "New"
        READ = "READ", "Read"
        REPLIED = "REPLIED", "Replied"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    subject = models.CharField(max_length=150)
    message = models.TextField(max_length=4000)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    submitted_from_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contact_messages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}: {self.subject}"


class Achievement(models.Model):
    """A real, school-confirmed achievement shown on /achievements. Entered by the Super Admin — nothing is pre-filled."""

    class Category(models.TextChoices):
        ACADEMIC = "ACADEMIC", "Academic"
        SPORTS = "SPORTS", "Sports"
        ARTS = "ARTS", "Arts & culture"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, max_length=1500)
    year = models.PositiveSmallIntegerField()
    category = models.CharField(max_length=10, choices=Category.choices, default=Category.ACADEMIC)
    image = models.ImageField(upload_to=achievement_path, blank=True, null=True)
    image_link = models.URLField(max_length=1000, blank=True)  # public picture link used instead of an upload
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "achievements"
        ordering = ["-year", "-created_at"]

    def __str__(self):
        return f"{self.title} ({self.year})"
