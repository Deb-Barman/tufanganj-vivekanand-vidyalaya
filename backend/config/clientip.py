"""The visitor's network address, worked out in a way a visitor cannot fake.

Why this matters: every rate limit (sign-in, contact form, admission form, forgot-password) and the sign-in lockout
are counted per address. Render's load balancer does NOT clear a ``X-Forwarded-For`` header that the visitor sent — it
only appends to it — so reading that header lets anybody pick a new "address" for every request and walk straight
through every limit. Render runs behind Cloudflare, and Cloudflare sets ``CF-Connecting-IP`` / ``True-Client-IP``
itself, overwriting anything the visitor sent, so those are the trustworthy ones.

Order used:
  1. CF-Connecting-IP, then True-Client-IP  (set by Cloudflare; cannot be typed by the visitor)
  2. the LAST X-Forwarded-For entry          (the one OUR proxy added; earlier entries can be typed by the visitor)
  3. REMOTE_ADDR                             (no proxy at all: local development)
"""
import ipaddress

from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, SimpleRateThrottle, UserRateThrottle


def _valid(value):
    try:
        return str(ipaddress.ip_address(str(value or "").strip()))
    except ValueError:
        return None


def client_ip(request):
    """Return ONE valid IP address string for `request`, or None. Never raises."""
    meta = getattr(request, "META", None) or {}
    for header in ("HTTP_CF_CONNECTING_IP", "HTTP_TRUE_CLIENT_IP"):
        ip = _valid(meta.get(header))
        if ip:
            return ip
    forwarded = [p for p in str(meta.get("HTTP_X_FORWARDED_FOR", "")).split(",") if p.strip()]
    if forwarded:
        ip = _valid(forwarded[-1])
        if ip:
            return ip
    return _valid(meta.get("REMOTE_ADDR"))


class ClientIPMixin:
    """Makes a Django REST framework throttle count per real visitor address (see module note)."""

    def get_ident(self, request):
        return client_ip(request) or "unknown"


class SafeAnonRateThrottle(ClientIPMixin, AnonRateThrottle):
    pass


class SafeUserRateThrottle(ClientIPMixin, UserRateThrottle):
    pass


class SafeScopedRateThrottle(ClientIPMixin, ScopedRateThrottle):
    pass


class SafeSimpleRateThrottle(ClientIPMixin, SimpleRateThrottle):
    """Base for the per-address throttles that set their own `scope`."""

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
