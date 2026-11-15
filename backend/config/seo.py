"""Keeps the school's data API and admin out of search results.

The website the public searches for lives on Vercel. This Django server (Render) only serves JSON and the pre-built admin, so every
response is marked "noindex": if its address is ever linked somewhere, Google will not list it next to (or instead of) the real website.
Images/files served through it are unaffected for the website itself — browsers ignore this header.
"""


class NoIndexMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
        return response


class ApiSecurityHeadersMiddleware:
    """Extra browser-side protection for the JSON API (/api/…). The Django admin keeps its own pages and is left alone.

    * Content-Security-Policy "default-src 'none'": an API answer can never run a script or load anything, even if a browser
      were tricked into showing it as a page.
    * Private answers (the request carried a sign-in token) are marked "no-store" so no cache or shared device keeps a
      copy of a student's marks or a Super Admin's lists. Public answers keep any caching they asked for.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith("/api/"):
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
            response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
            if request.META.get("HTTP_AUTHORIZATION") and "Cache-Control" not in response.headers:
                response.headers["Cache-Control"] = "private, no-store"
                response.headers["Pragma"] = "no-cache"
        return response
