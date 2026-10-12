from django.contrib import admin

from .models import Achievement, Admission, Article, ContactMessage, Event, GalleryImage, SchoolForm


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "published", "created_by", "created_at")
    list_filter = ("published",)
    search_fields = ("title", "body")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "event_date", "audience")


@admin.register(GalleryImage)
class GalleryImageAdmin(admin.ModelAdmin):
    list_display = ("caption", "uploaded_by", "created_at")


@admin.register(SchoolForm)
class SchoolFormAdmin(admin.ModelAdmin):
    list_display = ("title", "uploaded_by", "created_at")


@admin.register(Admission)
class AdmissionAdmin(admin.ModelAdmin):
    list_display = ("applicant_name", "applying_for_class", "status", "submitted_at")
    list_filter = ("status",)


# --- Registered so the Django admin (Render) shows the SAME modules as the
# --- Super Admin dashboard (Vercel): Messages (Contact page) and Achievements.

@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("subject", "name", "email", "phone", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "email", "phone", "subject", "message")
    readonly_fields = ("submitted_from_ip", "created_at")
    date_hierarchy = "created_at"


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ("title", "year", "category", "created_by", "created_at")
    list_filter = ("category", "year")
    search_fields = ("title", "description")
