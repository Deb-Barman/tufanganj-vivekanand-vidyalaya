from django.contrib import admin

from .models import Admission, Article, Event, GalleryImage, SchoolForm


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
