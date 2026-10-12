"""Safe client-IP helper for the public forms."""
import ipaddress

from rest_framework.throttling import BaseThrottle


def client_ip(request):
    """Return ONE valid IP address string for `request`, or None. Never raises.

    DRF's `get_ident()` returns the whole X-Forwarded-For header (comma-joined)
    when NUM_PROXIES is unset, which is what happens behind Render/Cloudflare:
    "203.0.113.7,172.70.1.2". SQLite stores that happily, but PostgreSQL's
    `inet` column rejects it, so every public form that saved the IP crashed
    with a 500 in production. We keep the first entry that is a real IP.
    """
    raw = BaseThrottle().get_ident(request)  # still honours NUM_PROXIES
    for part in str(raw or "").split(","):
        try:
            return str(ipaddress.ip_address(part.strip()))
        except ValueError:
            continue
    return None
