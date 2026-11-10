from django.urls import path

from . import views

app_name = "content"

urlpatterns = [
    # Articles / Blog
    path("articles/public/", views.PublicArticleListView.as_view(), name="public_articles"),
    path("articles/public/<str:slug>/", views.PublicArticleDetailView.as_view(), name="public_article"),
    path("articles/", views.ArticleListCreateView.as_view(), name="articles"),
    path("articles/<uuid:pk>/", views.ArticleDetailView.as_view(), name="article_detail"),
    # Events
    path("events/public/", views.PublicEventListView.as_view(), name="public_events"),
    path("events/", views.EventListCreateView.as_view(), name="events"),
    path("events/<uuid:pk>/", views.EventDetailView.as_view(), name="event_detail"),
    # Gallery
    path("gallery/public/", views.PublicGalleryListView.as_view(), name="public_gallery"),
    path("gallery/", views.GalleryListCreateView.as_view(), name="gallery"),
    path("gallery/<uuid:pk>/", views.GalleryDetailView.as_view(), name="gallery_detail"),
    # School Forms / Downloads
    path("forms/public/", views.PublicSchoolFormListView.as_view(), name="public_forms"),
    path("forms/", views.SchoolFormListCreateView.as_view(), name="forms"),
    path("forms/<uuid:pk>/", views.SchoolFormDetailView.as_view(), name="form_detail"),
    # App downloads (public /app page)
    path("apps/public/", views.PublicAppReleaseListView.as_view(), name="public_apps"),
    path("apps/", views.AppReleaseListCreateView.as_view(), name="apps"),
    path("apps/<uuid:pk>/", views.AppReleaseDetailView.as_view(), name="app_detail"),
    # Admissions
    path("admissions/submit/", views.AdmissionCreateView.as_view(), name="admission_submit"),
    path("admissions/", views.AdmissionListView.as_view(), name="admissions"),
    path("admissions/<uuid:pk>/", views.AdmissionDetailView.as_view(), name="admission_detail"),
    # Contact messages
    path("contact/submit/", views.ContactCreateView.as_view(), name="contact_submit"),
    path("contact/", views.ContactListView.as_view(), name="contact"),
    path("contact/<uuid:pk>/", views.ContactDetailView.as_view(), name="contact_detail"),
    # Achievements
    path("achievements/public/", views.PublicAchievementListView.as_view(), name="public_achievements"),
    path("achievements/public/<uuid:pk>/", views.PublicAchievementDetailView.as_view(), name="public_achievement_detail"),
    path("achievements/", views.AchievementListCreateView.as_view(), name="achievements"),
    path("achievements/<uuid:pk>/", views.AchievementDetailView.as_view(), name="achievement_detail"),
]
