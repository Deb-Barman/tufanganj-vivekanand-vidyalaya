"""
Branded error pages for anything a browser can reach on the backend (for
example a wrong /admin/ address). The HTML comes from templates/errors/<code>.html,
generated from the same design as the website's own error screens.

API clients (anything under /api/ or asking for JSON) still receive JSON.
"""
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render

_JSON = {
    400: "Bad request.",
    403: "You do not have permission to do that.",
    404: "Not found.",
    500: "Server error.",
}


def _wants_json(request) -> bool:
    accept = request.headers.get("Accept", "")
    return request.path.startswith("/api/") or ("application/json" in accept and "text/html" not in accept)


def _respond(request, status: int):
    if _wants_json(request):
        return JsonResponse({"detail": _JSON[status]}, status=status)
    base = settings.FRONTEND_URL.rstrip("/") + "/"
    response = render(request, f"errors/{status}.html", {"asset_base": base, "home_url": base}, status=status)
    response["Cache-Control"] = "no-store"
    return response


def bad_request(request, exception=None):
    return _respond(request, 400)


def permission_denied(request, exception=None):
    return _respond(request, 403)


def not_found(request, exception=None):
    return _respond(request, 404)


def server_error(request):
    return _respond(request, 500)
