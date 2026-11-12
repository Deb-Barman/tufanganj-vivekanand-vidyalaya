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
