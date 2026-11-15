"""
Custom DRF exception handler. Two goals:

1. Never leak internal details (stack traces, DB error text, file paths) to
   the client on an unhandled 500 — DEBUG=False already stops Django's
   default HTML debug page, but an uncaught exception in a view still
   risks bubbling up something too specific if not caught here.
2. Keep DRF's normal handling for expected exceptions (ValidationError,
   PermissionDenied, NotAuthenticated, Throttled, etc.) — those messages
   are safe and useful to the client already.
"""
import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_handler

logger = logging.getLogger(__name__)


def security_aware_exception_handler(exc, context):
    # A filter value that is not a valid ID / date (e.g. ?student=abc) raises Django's own ValidationError inside the
    # query. That is the caller's mistake, so answer 400 — not a 500 and an error in the logs.
    if isinstance(exc, DjangoValidationError):
        return Response({"detail": " ".join(exc.messages)[:300] or "Invalid value."}, status=400)

    response = drf_default_handler(exc, context)

    if response is not None:
        # A known DRF/API exception — its .detail is already safe to return.
        return response

    # Anything else is unexpected: log the real exception server-side with
    # full detail, but return only a generic message to the client.
    logger.exception("Unhandled exception in view: %s", context.get("view"))
    return Response({"detail": "An unexpected error occurred. Please try again."}, status=500)
