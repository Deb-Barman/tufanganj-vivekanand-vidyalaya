"""Date-window regressions for homework, including records predating start_date."""
from datetime import date, datetime, timedelta, timezone as dt_timezone
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from accounts.models import Role, User
from config.testing import BaseAPITestCase

from .models import AcademicSession, Homework, HomeworkCompletion, SchoolClass, Subject
from .serializers import HomeworkSerializer


DAY = date(2026, 10, 18)


class HomeworkWindowUnitTests(SimpleTestCase):
    def test_phase_includes_both_endpoints_and_handles_a_one_day_window(self):
        for start, end in ((DAY, DAY), (DAY, DAY + timedelta(days=2))):
            hw = Homework(start_date=start, due_date=end)
            for day, expected in ((start - timedelta(days=1), "upcoming"), (start, "open"),
                                  (end, "open"), (end + timedelta(days=1), "closed")):
                with self.subTest(start=start, end=end, day=day):
                    self.assertEqual(hw.phase(today=day), expected)

    def test_phase_defaults_to_the_local_day(self):
        hw = Homework(start_date=DAY, due_date=DAY)
        with patch("django.utils.timezone.localdate", return_value=DAY):
            self.assertEqual(hw.phase(), "open")

    def test_legacy_start_uses_the_creation_day_in_the_active_timezone(self):
        hw = Homework(created_at=datetime(2026, 10, 17, 20, tzinfo=dt_timezone.utc), due_date=DAY)
        with timezone.override("Asia/Kolkata"):
            self.assertEqual(hw.opens_on, DAY)
            self.assertEqual(hw.phase(today=DAY - timedelta(days=1)), "upcoming")
            self.assertEqual(hw.phase(today=DAY), "open")

    def test_explicit_start_overrides_creation_day(self):
        hw = Homework(start_date=DAY, created_at=datetime(2026, 1, 1, tzinfo=dt_timezone.utc))
        self.assertEqual(hw.opens_on, DAY)

    def test_unsaved_homework_without_a_start_uses_the_local_day(self):
        with patch("django.utils.timezone.localdate", return_value=DAY):
            self.assertEqual(Homework().opens_on, DAY)

    def test_partial_validation_checks_the_other_existing_endpoint(self):
        hw = Homework(start_date=DAY, due_date=DAY + timedelta(days=2))
        for changes in ({"start_date": DAY + timedelta(days=3)}, {"due_date": DAY - timedelta(days=1)}):
            with self.subTest(changes=changes):
                with self.assertRaises(ValidationError) as caught:
                    HomeworkSerializer(instance=hw).validate(changes)
                self.assertIn("due_date", caught.exception.detail)

    def test_unrelated_partial_update_keeps_dates_and_null_can_clear_start(self):
        hw = Homework(start_date=DAY, due_date=DAY)
        ser = HomeworkSerializer(instance=hw)
        self.assertEqual(ser.validate({"title": "Revised"}), {"title": "Revised"})
        self.assertEqual(ser.validate({"start_date": None}), {"start_date": None})

    def test_only_students_can_tick_and_only_during_the_window(self):
        for role in (Role.STUDENT, Role.TEACHER, Role.SUPER_ADMIN):
            ser = HomeworkSerializer(context={"request": SimpleNamespace(user=User(role=role))})
            for start, end, phase in ((DAY + timedelta(days=1), DAY + timedelta(days=2), "upcoming"),
                                      (DAY, DAY, "open"), (DAY - timedelta(days=2), DAY - timedelta(days=1), "closed")):
                with self.subTest(role=role, phase=phase), patch("django.utils.timezone.localdate", return_value=DAY):
                    hw = Homework(start_date=start, due_date=end)
                    self.assertEqual(ser.get_phase(hw), phase)
                    self.assertEqual(ser.get_can_tick(hw), role == Role.STUDENT and phase == "open")


class HomeworkWindowPersistenceTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        clock = patch("django.utils.timezone.localdate", return_value=DAY)
        clock.start()
        self.addCleanup(clock.stop)
        session = AcademicSession.objects.create(label="2026")
        self.klass = SchoolClass.objects.create(name="XI", session=session)
        self.subject = Subject.objects.create(name="Physics", school_class=self.klass)
        self.student = self.make_user("student", Role.STUDENT)
        self.profile = self.student.student_profile
        self.profile.school_class = self.klass
        self.profile.save()
        self.client = APIClient()
        self.client.force_authenticate(self.student)

    def homework(self, **overrides):
        return Homework.objects.create(school_class=self.klass, subject=self.subject, title="Read chapter 1",
                                       start_date=DAY, due_date=DAY, **overrides)

    def test_create_defaults_missing_or_null_start_without_overwriting_explicit_start(self):
        base = {"school_class": str(self.klass.pk), "subject": str(self.subject.pk), "title": "Chapter 1",
                "due_date": str(DAY + timedelta(days=2))}
        for extra, expected in (({}, DAY), ({"start_date": None}, DAY),
                                ({"start_date": str(DAY + timedelta(days=1))}, DAY + timedelta(days=1))):
            with self.subTest(extra=extra):
                ser = HomeworkSerializer(data={**base, **extra})
                self.assertTrue(ser.is_valid(), ser.errors)
                hw = ser.save()
                hw.refresh_from_db()
                self.assertEqual(hw.start_date, expected)

    def test_legacy_representation_supplies_start_without_modifying_the_database(self):
        hw = Homework.objects.create(school_class=self.klass, subject=self.subject, title="Legacy", due_date=DAY)
        Homework.objects.filter(pk=hw.pk).update(created_at=datetime(2026, 10, 17, 20, tzinfo=dt_timezone.utc))
        hw.refresh_from_db()
        with timezone.override("Asia/Kolkata"):
            data = HomeworkSerializer(hw, context={"request": SimpleNamespace(user=self.student), "done_ids": set()}).data
        self.assertEqual((data["start_date"], data["phase"], data["can_tick"]), (str(DAY), "open", True))
        hw.refresh_from_db()
        self.assertIsNone(hw.start_date)

    def test_partial_update_moves_both_endpoints_together(self):
        hw = self.homework()
        ser = HomeworkSerializer(hw, data={"start_date": str(DAY + timedelta(days=3)),
                                           "due_date": str(DAY + timedelta(days=3))}, partial=True)
        self.assertTrue(ser.is_valid(), ser.errors)
        ser.save()
        hw.refresh_from_db()
        self.assertEqual((hw.start_date, hw.due_date), (DAY + timedelta(days=3), DAY + timedelta(days=3)))

    def test_repeated_ticks_and_unticks_are_idempotent_on_a_one_day_window(self):
        hw = self.homework()
        url = f"/api/academics/homework/{hw.pk}/done/"
        for done in (True, True, False, False):
            with self.subTest(done=done):
                res = self.client.post(url, {"done": done}, format="json")
                self.assertEqual(res.status_code, 200, res.data)
                self.assertEqual(res.data, {"id": str(hw.pk), "done": done})
                self.assertEqual(hw.completions.count(), int(done))

    def test_upcoming_homework_cannot_be_ticked_or_unticked(self):
        hw = self.homework()
        Homework.objects.filter(pk=hw.pk).update(start_date=DAY + timedelta(days=1), due_date=DAY + timedelta(days=2))
        completion = HomeworkCompletion.objects.create(homework=hw, student=self.profile)
        for done in (True, False):
            with self.subTest(done=done):
                res = self.client.post(f"/api/academics/homework/{hw.pk}/done/", {"done": done}, format="json")
                self.assertEqual(res.status_code, 400, res.data)
                self.assertIn("opens on", str(res.data["detail"]))
                self.assertEqual(list(hw.completions.values_list("pk", flat=True)), [completion.pk])
