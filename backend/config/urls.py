from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.urls import include, path


# Clear labels on the Render admin so it is obvious this is the school's backend admin.
admin.site.site_header = "TVV Portal — Django Admin"
admin.site.site_title = "TVV Admin"
admin.site.index_title = "School data (same modules as the Super Admin dashboard)"


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/health/", health_check, name="health_check"),
    path("api/auth/", include("accounts.urls")),
    path("api/notices/", include("notices.urls")),
    path("api/academics/", include("academics.urls")),
    path("api/content/", include("content.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler400 = "config.error_views.bad_request"
handler403 = "config.error_views.permission_denied"
handler404 = "config.error_views.not_found"
handler500 = "config.error_views.server_error"
