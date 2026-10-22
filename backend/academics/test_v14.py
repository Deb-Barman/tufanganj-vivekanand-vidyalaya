"""V14 — result semesters, marksheet links, faculty cards, picture positions."""
from decimal import Decimal

from accounts.models import PublicProfile, Role
from content.adjust import clean_adjust
from config.testing import BaseAPITestCase

from .models import AcademicSession, Marksheet, Result, SchoolClass, StudentProfile, Subject, TeacherProfile


class V14Base(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.teacher = self.make_user("teach1", Role.TEACHER)
        self.stu_user = self.make_user("alice", Role.STUDENT)
        self.stu = StudentProfile.objects.get(user=self.stu_user)
        self.session = AcademicSession.objects.create(label="2026", is_current=True, working_days=200)
        self.klass = SchoolClass.objects.create(name="Class VI", session=self.session)
        self.subject = Subject.objects.create(name="English", school_class=self.klass)
        self.admin_c, self.teacher_c, self.stu_c = self.login(self.admin), self.login(self.teacher), self.login(self.stu_user)


class ResultTermTests(V14Base):
    def bulk(self, term=None, marks="70.00"):
        body = {"subject": str(self.subject.id), "session": str(self.session.id), "full_marks": "100.00", "records": [{"student": str(self.stu.pk), "marks_obtained": marks}]}
        if term:
            body["term"] = term
        return self.teacher_c.post("/api/academics/results/bulk/", body, format="json")

    def test_default_term_is_first_semester(self):
        self.assertEqual(self.bulk().status_code, 200)
        self.assertEqual(Result.objects.get().term, "SEM1")

    def test_same_subject_can_have_marks_in_each_semester(self):
        self.bulk("SEM1", "70.00")
        self.bulk("SEM2", "88.00")
        self.assertEqual(Result.objects.count(), 2)
        self.assertEqual(Result.objects.get(term="SEM2").marks_obtained, Decimal("88.00"))

    def test_saving_a_semester_again_updates_instead_of_duplicating(self):
        self.bulk("SEM2", "60.00")
        self.bulk("SEM2", "65.00")
        self.assertEqual(Result.objects.filter(term="SEM2").count(), 1)
        self.assertEqual(Result.objects.get(term="SEM2").marks_obtained, Decimal("65.00"))

    def test_unknown_term_is_refused(self):
        self.assertEqual(self.bulk("SEM9").status_code, 400)

    def test_student_reads_term_and_can_filter(self):
        self.bulk("SEM1")
        self.bulk("SEM2")
        res = self.stu_c.get("/api/academics/results/")
        self.assertEqual(sorted(r["term"] for r in res.data["results"]), ["SEM1", "SEM2"])
        res = self.teacher_c.get("/api/academics/results/?term=SEM2")
        self.assertEqual([r["term"] for r in res.data["results"]], ["SEM2"])

    def test_bulk_import_understands_semester_words(self):
        from bulkimport.importers import parse_term

        self.assertEqual(parse_term(""), "SEM1")
        self.assertEqual(parse_term("Second Semester"), "SEM2")
        self.assertEqual(parse_term("sem 3"), "SEM3")
        self.assertEqual(parse_term("4"), "SEM4")
        self.assertEqual(parse_term("Annual"), "ANNUAL")
        self.assertIsNone(parse_term("midterm-ish"))


class MarksheetLinkTests(V14Base):
    def test_super_admin_can_attach_a_drive_link_instead_of_a_file(self):
        link = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing"
        res = self.admin_c.post("/api/academics/marksheets/create/", {"student": str(self.stu.pk), "session": str(self.session.id), "file_link": link}, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Marksheet.objects.get().file_link.startswith("https://drive.google.com/"), True)
        # the student sees the link in the usual `file` field
        got = self.stu_c.get("/api/academics/marksheets/").data["results"][0]
        self.assertTrue(got["file"].startswith("https://drive.google.com/"))
        self.assertEqual(got["source"], "link")

    def test_a_junk_link_is_refused(self):
        res = self.admin_c.post("/api/academics/marksheets/create/", {"student": str(self.stu.pk), "session": str(self.session.id), "file_link": "javascript:alert(1)"}, format="multipart")
        self.assertEqual(res.status_code, 400)

    def test_teacher_cannot_create_marksheets(self):
        res = self.teacher_c.post("/api/academics/marksheets/create/", {"student": str(self.stu.pk), "session": str(self.session.id), "file_link": "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view"}, format="multipart")
        self.assertEqual(res.status_code, 403)


class FacultyCardTests(V14Base):
    def setUp(self):
        super().setUp()
        TeacherProfile.objects.filter(user=self.teacher).update(department="Physics", years_experience=5)

    def public_list(self):
        self.client.force_authenticate(None)
        return self.client.get("/api/academics/teachers/public/").data["results"]

    def test_private_profile_leaks_nothing_into_the_faculty_list(self):
        PublicProfile.objects.update_or_create(user=self.teacher, defaults={"headline": "Secret headline", "photo_link": "https://i.imgur.com/abc1234.jpg", "is_public": False})
        row = self.public_list()[0]
        self.assertIsNone(row["profile"])
        self.assertNotIn("Secret headline", str(row))

    def test_published_profile_appears_as_a_card_with_a_path_to_the_full_page(self):
        PublicProfile.objects.update_or_create(user=self.teacher, defaults={"headline": "Physics teacher", "qualification": "M.Sc. B.Ed.", "photo_link": "https://i.imgur.com/abc1234.jpg", "photo_adjust": "40,30,1.5", "is_public": True})
        row = self.public_list()[0]
        self.assertEqual(row["profile"]["headline"], "Physics teacher")
        self.assertEqual(row["profile"]["path"], "/profile/teacher/teach1")
        self.assertEqual(row["profile"]["photo_adjust"], "40,30,1.5")
        self.assertEqual(row["profile"]["photo"], "https://i.imgur.com/abc1234.jpg")
        # never private data
        for k in ("phone", "email", "guardian_contact"):
            self.assertNotIn(k, str(row))

    def test_disabled_teacher_card_is_hidden(self):
        PublicProfile.objects.update_or_create(user=self.teacher, defaults={"headline": "Hi", "is_public": True})
        self.teacher.is_active_account = False
        self.teacher.save(update_fields=["is_active_account"])
        self.assertIsNone(self.public_list()[0]["profile"])

    def test_portal_faculty_list_has_the_same_card(self):
        PublicProfile.objects.update_or_create(user=self.teacher, defaults={"headline": "Physics teacher", "is_public": True})
        res = self.stu_c.get("/api/academics/teachers/")
        self.assertEqual(res.data["results"][0]["profile"]["headline"], "Physics teacher")


class PictureAdjustTests(V14Base):
    def test_clean_adjust(self):
        self.assertEqual(clean_adjust(""), "")
        self.assertEqual(clean_adjust("50,50,1"), "")  # the default is not stored
        self.assertEqual(clean_adjust(" 40.5 , 20 , 1.75 "), "40.5,20,1.75")
        for bad in ("abc", "101,50,1", "50,50,0.5", "50,50,9", "50,50", "50;50;1"):
            with self.assertRaises(ValueError):
                clean_adjust(bad)

    def test_profile_photo_position_is_saved_and_reset_with_a_new_photo(self):
        c = self.stu_c
        res = c.patch("/api/auth/me/profile/", {"photo_link": "https://i.imgur.com/abc1234.jpg", "photo_adjust": "30,60,2"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["photo_adjust"], "30,60,2")
        res = c.patch("/api/auth/me/profile/", {"photo_link": "https://i.imgur.com/zzz9999.jpg"}, format="json")
        self.assertEqual(res.data["photo_adjust"], "")  # new picture -> centred again
        self.assertEqual(c.patch("/api/auth/me/profile/", {"photo_adjust": "999,1,1"}, format="json").status_code, 400)

    def test_gallery_position_is_saved_for_a_link_and_shown_publicly(self):
        res = self.admin_c.post("/api/content/gallery/", {"caption": "x", "image_link": "https://i.imgur.com/abc1234.jpg", "image_adjust": "20,80,1.5"}, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["image_adjust"], "20,80,1.5")
        pub = self.client.get("/api/content/gallery/public/").data["results"][0]
        self.assertEqual(pub["image_adjust"], "20,80,1.5")
        # replacing the picture without a position resets it
        gid = res.data["id"]
        res = self.admin_c.patch(f"/api/content/gallery/{gid}/", {"image_link": "https://i.imgur.com/other99.jpg"}, format="multipart")
        self.assertEqual(res.data["image_adjust"], "")
