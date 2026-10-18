from django.urls import path

from . import views

app_name = "bulkimport"

urlpatterns = [
    path("", views.CatalogView.as_view(), name="catalog"),
    path("<str:key>/sample/", views.SampleView.as_view(), name="sample"),
    path("<str:key>/preview/", views.PreviewView.as_view(), name="preview"),
    path("<str:key>/commit/", views.CommitView.as_view(), name="commit"),
]
