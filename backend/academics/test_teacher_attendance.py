"""Validation, batch integrity and record lifecycle for the new staff register."""
from datetime import date, timedelta
from unittest.mock import patch
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import Role, User
from config.testing import BaseAPITestCase

from .models import TeacherAttendance
from .serializers import BulkTeacherAttendanceSerializer, _check_not_future, _check_teacher


DAY = date(2026, 10, 18)
BASE_URL = "/api/academics/teacher-attendance/"


class TeacherAttendanceValidationTests(SimpleTestCase):
    def test_today_and_past_dates_are_allowed_but_tomorrow_is_rejected(self):
        with patch("django.utils.timezone.localdate", return_value=DAY):
            for day in (DAY, DAY - timedelta(days=1)):
                with self.subTest(day=day):
                    self.assertEqual(_check_not_future(day), day)
            with self.assertRaisesMessage(ValidationError, "future date"):
                _check_not_future(DAY + timedelta(days=1))

    def test_only_active_teacher_accounts_are_valid(self):
        teacher = User(role=Role.TEACHER, is_active_account=True)
        self.assertIs(_check_teacher(teacher), teacher)
        for role, active, message in ((Role.TEACHER, False, "disabled"), (Role.STUDENT, True, "Teacher account"),
                                      (Role.SUPER_ADMIN, True, "Teacher account")):
            with self.subTest(role=role, active=active):
                with self.assertRaisesMessage(ValidationError, message):
                    _check_teacher(User(role=role, is_active_account=active))


class TeacherAttendanceBatchTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        clock = patch("django.utils.timezone.localdate", return_value=DAY)
        clock.start()
        self.addCleanup(clock.stop)
        self.admin = self.make_admin()
        self.teacher = self.make_user("teacher-a", Role.TEACHER, full_name="Alice Teacher")
        self.other = self.make_user("teacher-z", Role.TEACHER, full_name="Zoe Teacher")
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def record(self, teacher=None, status="PRESENT"):
        return {"teacher": str((teacher or self.teacher).pk), "status": status}

    def mark(self, records):
        return self.client.post(BASE_URL + "bulk/", {"date": str(DAY), "records": records}, format="json")

    def test_invalid_member_rejects_the_whole_batch_without_updating_existing_marks(self):
        original = TeacherAttendance.objects.create(teacher=self.teacher, date=DAY, status="PRESENT", marked_by=self.admin)
        res = self.mark([self.record(status="ABSENT"), self.record(self.other, status="LATE")])
        self.assertEqual(res.status_code, 400, res.data)
        original.refresh_from_db()
        self.assertEqual(original.status, "PRESENT")
        self.assertEqual(TeacherAttendance.objects.count(), 1)

    def test_batch_size_is_bounded_and_records_are_required(self):
        for records in ([], [self.record()] * 301):
            with self.subTest(count=len(records)):
                res = self.mark(records)
                self.assertEqual(res.status_code, 400, res.data)
                self.assertIn("records", res.data)
        for payload, field in (({"date": str(DAY)}, "records"), ({"records": [self.record()]}, "date")):
            with self.subTest(missing=field):
                res = self.client.post(BASE_URL + "bulk/", payload, format="json")
                self.assertEqual(res.status_code, 400, res.data)
                self.assertIn(field, res.data)
        self.assertEqual(TeacherAttendance.objects.count(), 0)

    def test_maximum_batch_size_validates(self):
        ser = BulkTeacherAttendanceSerializer(data={"date": str(DAY), "records": [self.record()] * 300})
        self.assertTrue(ser.is_valid(), ser.errors)
        self.assertEqual(len(ser.validated_data["records"]), 300)

    def test_unknown_teacher_and_malformed_date_cannot_create_records(self):
        bodies = ({"date": str(DAY), "records": [{"teacher": str(uuid4()), "status": "PRESENT"}]},
                  {"date": "2026-02-30", "records": [self.record()]})
        for body in bodies:
            with self.subTest(body=body):
                res = self.client.post(BASE_URL + "bulk/", body, format="json")
                self.assertEqual(res.status_code, 400, res.data)
        self.assertFalse(TeacherAttendance.objects.exists())

    def test_sheet_defaults_to_local_today_orders_names_and_includes_departments(self):
        profile = self.teacher.teacher_profile
        profile.department = "Science"
        profile.save()
        TeacherAttendance.objects.create(teacher=self.teacher, date=DAY - timedelta(days=1), status="ABSENT", marked_by=self.admin)
        TeacherAttendance.objects.create(teacher=self.other, date=DAY, status="PRESENT", marked_by=self.admin)
        res = self.client.get(BASE_URL + "sheet/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data, {"date": str(DAY), "teachers": [
            {"teacher": str(self.teacher.pk), "full_name": "Alice Teacher", "department": "Science", "status": None},
            {"teacher": str(self.other.pk), "full_name": "Zoe Teacher", "department": "", "status": "PRESENT"},
        ]})

    def test_detail_cannot_move_a_record_to_a_non_teacher_disabled_teacher_or_future_day(self):
        student = self.make_user("student", Role.STUDENT)
        self.other.is_active_account = False
        self.other.save()
        row = TeacherAttendance.objects.create(teacher=self.teacher, date=DAY, status="PRESENT", marked_by=self.admin)
        for body in ({"teacher": str(student.pk)}, {"teacher": str(self.other.pk)},
                     {"date": str(DAY + timedelta(days=1))}, {"status": "LATE"}):
            with self.subTest(body=body):
                res = self.client.patch(f"{BASE_URL}{row.pk}/", body, format="json")
                self.assertEqual(res.status_code, 400, res.data)
                row.refresh_from_db()
                self.assertEqual((row.teacher_id, row.date, row.status), (self.teacher.pk, DAY, "PRESENT"))

    def test_detail_rejects_a_duplicate_day_and_does_not_allow_marker_spoofing(self):
        row = TeacherAttendance.objects.create(teacher=self.teacher, date=DAY, status="PRESENT", marked_by=self.admin)
        TeacherAttendance.objects.create(teacher=self.teacher, date=DAY - timedelta(days=1), status="ABSENT", marked_by=self.admin)
        url = f"{BASE_URL}{row.pk}/"
        res = self.client.patch(url, {"date": str(DAY - timedelta(days=1))}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
        res = self.client.patch(url, {"status": "ABSENT", "marked_by": str(self.other.pk)}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        row.refresh_from_db()
        self.assertEqual((row.date, row.status, row.marked_by_id), (DAY, "ABSENT", self.admin.pk))

    def test_deleting_the_marker_preserves_teacher_history(self):
        row = TeacherAttendance.objects.create(teacher=self.teacher, date=DAY, status="PRESENT", marked_by=self.admin)
        self.admin.delete()
        row.refresh_from_db()
        self.assertIsNone(row.marked_by_id)
        self.assertEqual(row.teacher_id, self.teacher.pk)

    def test_database_enforces_one_mark_per_teacher_per_day(self):
        TeacherAttendance.objects.create(teacher=self.teacher, date=DAY, status="PRESENT", marked_by=self.admin)
        with self.assertRaises(IntegrityError), transaction.atomic():
            TeacherAttendance.objects.create(teacher=self.teacher, date=DAY, status="ABSENT", marked_by=self.admin)
        self.assertEqual(TeacherAttendance.objects.get().status, "PRESENT")

    def test_teacher_cannot_read_a_detail_even_when_it_is_their_own(self):
        row = TeacherAttendance.objects.create(teacher=self.teacher, date=DAY, status="PRESENT", marked_by=self.admin)
        self.client.force_authenticate(self.teacher)
        self.assertEqual(self.client.get(f"{BASE_URL}{row.pk}/").status_code, 403)
