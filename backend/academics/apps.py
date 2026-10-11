from django.apps import AppConfig


class AcademicsConfig(AppConfig):
    name = "academics"

    def ready(self):
        from . import signals  # noqa: F401  (registers the profile-creation receiver)
