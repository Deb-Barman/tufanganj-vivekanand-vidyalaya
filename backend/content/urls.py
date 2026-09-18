from django.urls import path

from . import views

app_name = "content"

urlpatterns = [
    # Articles / Blog
    path("articles/public/", views.PublicArticleListView.as_view(), name="public_articles"),
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
    # Admissions
    path("admissions/submit/", views.AdmissionCreateView.as_view(), name="admission_submit"),
    path("admissions/", views.AdmissionListView.as_view(), name="admissions"),
    path("admissions/<uuid:pk>/", views.AdmissionDetailView.as_view(), name="admission_detail"),
]
