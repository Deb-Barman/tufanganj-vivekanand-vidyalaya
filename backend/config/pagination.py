from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """25 per page by default; the dashboard asks for ?page_size=200 when it needs a whole class."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200
