from rest_framework import generics
from rest_framework.permissions import AllowAny

from accounts.permissions import IsSuperAdminOrReadOnly

from .models import Notice
from .serializers import NoticeSerializer


class PublicNoticeListView(generics.ListAPIView):
    """
    Unauthenticated read access for the public website's Notices section
    (school announcements are public-facing content, not private student
    data — matches context.md's public site requirements).
    """

    permission_classes = [AllowAny]
    serializer_class = NoticeSerializer
    queryset = Notice.objects.all()[:20]


class NoticeListCreateView(generics.ListCreateAPIView):
    """
    Portal-side: any signed-in active user can read; only Super Admin can
    publish. See accounts.permissions.IsSuperAdminOrReadOnly.
    """

    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = NoticeSerializer
    queryset = Notice.objects.all()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class NoticeDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperAdminOrReadOnly]
    serializer_class = NoticeSerializer
    queryset = Notice.objects.all()
