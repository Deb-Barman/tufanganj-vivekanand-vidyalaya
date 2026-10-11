from django.test import RequestFactory, SimpleTestCase, override_settings

from config import error_views


@override_settings(FRONTEND_URL="https://school.example/", ALLOWED_HOSTS=["testserver"])
class BrandedErrorPageTests(SimpleTestCase):
    def test_unknown_browser_url_gets_the_branded_404(self):
        res = self.client.get("/definitely/not/here/")
        self.assertEqual(res.status_code, 404)
        body = res.content.decode()
        self.assertIn("Error 404", body)
        self.assertIn("https://school.example/swami-dark.webp", body)  # assets load from the website
        self.assertIn('href="https://school.example/"', body)  # "Return home" goes to the website
        self.assertEqual(res["Cache-Control"], "no-store")

    def test_unknown_api_url_still_returns_json(self):
        res = self.client.get("/api/nope/")
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json(), {"detail": "Not found."})

    def test_client_asking_for_json_gets_json(self):
        res = self.client.get("/nope/", HTTP_ACCEPT="application/json")
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()["detail"], "Not found.")

    def test_every_handler_renders_its_own_template(self):
        rf = RequestFactory()
        for handler, code in ((error_views.bad_request, 400), (error_views.permission_denied, 403), (error_views.not_found, 404), (error_views.server_error, 500)):
            res = handler(rf.get("/somewhere/"))
            self.assertEqual(res.status_code, code)
            self.assertIn(f"Error {code}", res.content.decode())

    def test_templates_survive_django_rendering_untouched(self):
        # {% verbatim %} must keep the CSS/JS braces intact.
        html = self.client.get("/x/").content.decode()
        self.assertIn(".tvv-err", html)
        self.assertIn("localStorage.getItem(\"tvv-theme\")", html)
        self.assertNotIn("{% verbatim", html)
