import io
import os
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import Role, User
from content.links import LinkError, drive_download_url, normalize_file_link, normalize_image_link
from content.models import Achievement, Article, GalleryImage, SchoolForm

PW = "Str0ng-Pass-123"
TMP = tempfile.mkdtemp()
FID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345"


def png():
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), (10, 20, 30)).save(buf, format="PNG")
    return SimpleUploadedFile("p.png", buf.getvalue(), content_type="image/png")


def pdf():
    return SimpleUploadedFile("f.pdf", b"%PDF-1.4 test", content_type="application/pdf")


class NormalizeImageLink(APITestCase):
    def ok(self, url, expect=None):
        out = normalize_image_link(url)
        if expect:
            self.assertEqual(out, expect)
        self.assertEqual(normalize_image_link(out), out, "normalising twice must change nothing")
        return out

    def bad(self, url):
        with self.assertRaises(LinkError) as cm:
            normalize_image_link(url)
        return str(cm.exception)

    def test_google_drive_forms(self):
        thumb = f"https://drive.google.com/thumbnail?id={FID}&sz=w1600"
        self.ok(f"https://drive.google.com/file/d/{FID}/view?usp=sharing", thumb)
        self.ok(f"https://drive.google.com/open?id={FID}", thumb)
        self.ok(f"https://drive.google.com/uc?export=view&id={FID}", thumb)
        self.ok(f"drive.google.com/file/d/{FID}/view", thumb)  # pasted without https://
        self.assertIn("folder", self.bad(f"https://drive.google.com/drive/folders/{FID}"))
        self.assertIn("Could not find", self.bad("https://drive.google.com/"))

    def test_other_picture_hosts(self):
        self.ok("https://i.imgur.com/abc123.png")
        self.ok("https://imgur.com/AbC12dE", "https://i.imgur.com/AbC12dE.jpg")
        self.assertIn("album", self.bad("https://imgur.com/a/xyz123"))
        self.ok("https://www.dropbox.com/s/abc/pic.jpg?dl=0", "https://www.dropbox.com/s/abc/pic.jpg?raw=1")
        self.ok("https://example.org/images/photo.WEBP")
        self.ok("https://pbs.twimg.com/media/Abc123?format=jpg&name=large")
        self.ok("https://scontent-del1-1.cdninstagram.com/v/t51/a_b.jpg?x=1")
        self.ok("https://lh3.googleusercontent.com/d/" + FID)

    def test_social_pages_are_explained_not_accepted(self):
        for url in ("https://www.facebook.com/photo?fbid=1", "https://www.instagram.com/p/ABC123/", "https://x.com/user/status/1", "https://twitter.com/u/status/2"):
            self.assertIn("social media", self.bad(url), url)

    def test_plain_web_pages_and_unsafe_links(self):
        self.assertIn("web page", self.bad("https://example.org/gallery/page"))
        for url in ("http://example.org/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "file:///etc/passwd", "ftp://x.org/a.jpg", "https://localhost/a.png", "https://127.0.0.1/a.png", "https://user:pw@example.org/a.png", "https://nodot/a.png", "", "   ", "https://x.org/" + "a" * 1100 + ".jpg"):
            with self.assertRaises(LinkError, msg=url):
                normalize_image_link(url)


class NormalizeFileLink(APITestCase):
    def test_files(self):
        self.assertEqual(normalize_file_link(f"https://drive.google.com/file/d/{FID}/view?usp=drive_link"), f"https://drive.google.com/file/d/{FID}/view")
        self.assertEqual(normalize_file_link(f"https://drive.google.com/open?id={FID}"), f"https://drive.google.com/file/d/{FID}/view")
        self.assertEqual(normalize_file_link(f"https://drive.google.com/drive/folders/{FID}?usp=sharing"), f"https://drive.google.com/drive/folders/{FID}")
        self.assertEqual(normalize_file_link(f"https://docs.google.com/document/d/{FID}/edit?usp=sharing"), f"https://docs.google.com/document/d/{FID}/edit")
        self.assertEqual(normalize_file_link("https://www.dropbox.com/s/x/form.pdf?dl=0"), "https://www.dropbox.com/s/x/form.pdf?dl=0")
        self.assertEqual(normalize_file_link("example.org/a.pdf#frag"), "https://example.org/a.pdf")
        for bad in ("javascript:alert(1)", "http://example.org/a.pdf", "https://drive.google.com/", ""):
            with self.assertRaises(LinkError, msg=bad):
                normalize_file_link(bad)

    def test_direct_download_address(self):
        self.assertEqual(drive_download_url(f"https://drive.google.com/file/d/{FID}/view"), f"https://drive.google.com/uc?export=download&id={FID}")
        self.assertIsNone(drive_download_url("https://example.org/a.pdf"))
        self.assertIsNone(drive_download_url(""))


@override_settings(MEDIA_ROOT=TMP)
class LinkOrUploadApi(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)

    def setUp(self):
        self.admin = User.objects.create_user("head", PW, role=Role.SUPER_ADMIN, full_name="Head", is_staff=True)
        self.client.force_authenticate(self.admin)

    def post(self, url, data):
        return self.client.post(url, data, format="multipart")

    # gallery (picture required: upload OR link)
    def test_gallery_with_a_link(self):
        r = self.post("/api/content/gallery/", {"caption": "Sports", "image_link": f"https://drive.google.com/file/d/{FID}/view?usp=sharing"})
        self.assertEqual(r.status_code, 201, r.content)
        d = r.json()
        self.assertEqual(d["image"], f"https://drive.google.com/thumbnail?id={FID}&sz=w1600")
        self.assertEqual((d["source"], bool(GalleryImage.objects.get().image)), ("link", False))  # nothing stored
        public = self.client.get("/api/content/gallery/public/").json()
        rows = public["results"] if isinstance(public, dict) else public
        self.assertEqual(rows[0]["image"], d["image"])

    def test_gallery_needs_exactly_one_of_upload_or_link(self):
        self.assertEqual(self.post("/api/content/gallery/", {"caption": "none"}).status_code, 400)
        both = self.post("/api/content/gallery/", {"caption": "both", "image": png(), "image_link": "https://i.imgur.com/abc123.png"})
        self.assertEqual(both.status_code, 400)
        self.assertEqual(self.post("/api/content/gallery/", {"caption": "x", "image_link": "https://www.instagram.com/p/ABC/"}).status_code, 400)
        self.assertEqual(self.post("/api/content/gallery/", {"caption": "x", "image_link": "javascript:alert(1)"}).status_code, 400)
        self.assertEqual(GalleryImage.objects.count(), 0)

    def test_upload_still_works_and_switching_cleans_up_the_old_file(self):
        r = self.post("/api/content/gallery/", {"caption": "up", "image": png()})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["source"], "upload")
        g = GalleryImage.objects.get()
        path = g.image.path
        self.assertTrue(os.path.exists(path))
        with self.captureOnCommitCallbacks(execute=True):
            r = self.client.patch(f"/api/content/gallery/{g.pk}/", {"image_link": "https://i.imgur.com/abc123.png"}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        g.refresh_from_db()
        self.assertFalse(g.image)
        self.assertEqual(g.image_link, "https://i.imgur.com/abc123.png")
        self.assertFalse(os.path.exists(path))  # the uploaded file is gone: storage freed
        r = self.client.patch(f"/api/content/gallery/{g.pk}/", {"image": png()}, format="multipart")
        g.refresh_from_db()
        self.assertTrue(g.image)
        self.assertEqual(g.image_link, "")
        self.assertEqual(r.json()["source"], "upload")

    def test_editing_caption_keeps_the_link(self):
        g = GalleryImage.objects.create(caption="old", image_link="https://i.imgur.com/abc123.png")
        r = self.client.patch(f"/api/content/gallery/{g.pk}/", {"caption": "new"}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        g.refresh_from_db()
        self.assertEqual((g.caption, g.image_link), ("new", "https://i.imgur.com/abc123.png"))
        # but you cannot remove the only picture
        self.assertEqual(self.client.patch(f"/api/content/gallery/{g.pk}/", {"image_link": ""}, format="multipart").status_code, 400)

    # downloads (file required: upload OR link)
    def test_download_with_a_drive_link(self):
        r = self.post("/api/content/forms/", {"title": "Admission form", "file_link": f"https://drive.google.com/open?id={FID}"})
        self.assertEqual(r.status_code, 201, r.content)
        d = r.json()
        self.assertEqual(d["file"], f"https://drive.google.com/file/d/{FID}/view")
        self.assertEqual(d["download_url"], f"https://drive.google.com/uc?export=download&id={FID}")
        self.assertEqual(d["source"], "link")
        self.assertFalse(SchoolForm.objects.get().file)
        self.assertEqual(self.post("/api/content/forms/", {"title": "x"}).status_code, 400)
        self.assertEqual(self.post("/api/content/forms/", {"title": "x", "file": pdf(), "file_link": "https://example.org/a.pdf"}).status_code, 400)
        ok = self.post("/api/content/forms/", {"title": "Real upload", "file": pdf()})
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(ok.json()["source"], "upload")

    # optional pictures
    def test_achievement_and_article_cover_links(self):
        r = self.post("/api/content/achievements/", {"title": "Quiz winner", "year": 2025, "category": "ACADEMIC", "image_link": "https://pbs.twimg.com/media/Abc123?format=jpg"})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["source"], "link")
        self.assertEqual(Achievement.objects.get().image_link, "https://pbs.twimg.com/media/Abc123?format=jpg")
        plain = self.post("/api/content/achievements/", {"title": "No picture", "year": 2025, "category": "OTHER"})
        self.assertEqual((plain.status_code, plain.json()["source"]), (201, None))
        a = self.post("/api/content/articles/", {"title": "Hello", "body": "Body text", "published": True, "cover_link": f"https://drive.google.com/file/d/{FID}/view"})
        self.assertEqual(a.status_code, 201, a.content)
        self.assertEqual(Article.objects.get().cover_link, f"https://drive.google.com/thumbnail?id={FID}&sz=w1600")
        pub = self.client.get(f"/api/content/articles/public/{a.json()['slug']}/").json()
        self.assertEqual(pub["cover_image"], f"https://drive.google.com/thumbnail?id={FID}&sz=w1600")
