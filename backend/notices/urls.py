from django.urls import path

from . import views

app_name = "notices"

urlpatterns = [
    path("public/", views.PublicNoticeListView.as_view(), name="public_list"),
    path("public/<uuid:pk>/", views.PublicNoticeDetailView.as_view(), name="public_detail"),
    path("", views.NoticeListCreateView.as_view(), name="list_create"),
    path("<uuid:pk>/", views.NoticeDetailView.as_view(), name="detail"),
]
