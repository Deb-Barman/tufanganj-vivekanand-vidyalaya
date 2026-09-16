from django.contrib import admin

from .models import Notice


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ("title", "target_class", "created_by", "created_at")
    search_fields = ("title", "body")
    list_filter = ("target_class",)
