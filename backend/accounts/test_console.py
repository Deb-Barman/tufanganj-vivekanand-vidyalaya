"""Unit coverage for console formatting/storage and data-browser regressions."""
import csv
import io
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import UUID

from django.http import Http404
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

from config.testing import BaseAPITestCase

from . import console_views as console
from .models import Role, User


class ConsoleHelperTests(SimpleTestCase):
    def test_cells_keep_primitives_and_convert_dates_uuids_and_decimals(self):
        stamp = datetime(2026, 10, 18, 10, 30, tzinfo=timezone.utc)
        identifier = UUID("12345678-1234-5678-1234-567812345678")
        for value, expected in ((None, None), (False, False), (True, True), (0, 0), (1.5, 1.5),
                                (date(2026, 10, 18), "2026-10-18"), (stamp, "2026-10-18T10:30:00+00:00"),
                                (identifier, str(identifier)), (Decimal("12.50"), "12.50")):
            with self.subTest(value=value):
                self.assertEqual(console._cell(value), expected)

    def test_cells_truncate_only_beyond_the_limit(self):
        for length in (399, 400, 401):
            with self.subTest(length=length):
                expected = "ক" * min(length, 400) + ("…" if length > 400 else "")
                self.assertEqual(console._cell("ক" * length), expected)

    def test_csv_neutralizes_each_formula_prefix_and_keeps_regular_cells(self):
        for prefix in ("=", "+", "-", "@", "\t", "\r"):
            with self.subTest(prefix=prefix):
                self.assertEqual(console._csv_safe(prefix + "payload"), "'" + prefix + "payload")
        for value, expected in ((None, ""), ("", ""), (0, "0"), ("শিক্ষা", "শিক্ষা"), ("a=b", "a=b")):
            with self.subTest(value=value):
                self.assertEqual(console._csv_safe(value), expected)

    def test_plan_limits_accept_decimal_megabytes_and_fall_back_on_bad_values(self):
        for setting, expected in (("1.5", 1572864), (0, 0), (None, 524288000), ("bad", 524288000)):
            with self.subTest(setting=setting), override_settings(SUPABASE_DB_LIMIT_MB=setting):
                self.assertEqual(console._limit_bytes("SUPABASE_DB_LIMIT_MB", 500), expected)
        self.assertEqual(console._mb(1572864), 1.5)

    def test_page_arguments_clamp_values_and_recover_from_malformed_input(self):
        cases = (({}, (1, 25)), ({"page": "0", "page_size": "0"}, (1, 1)),
                 ({"page": "-2", "page_size": "101"}, (1, 100)),
                 ({"page": "oops", "page_size": "1.5"}, (1, 25)),
                 ({"page": "3", "page_size": "2"}, (3, 2)))
        for params, expected in cases:
            with self.subTest(params=params):
                self.assertEqual(console._page_args(SimpleNamespace(query_params=params)), expected)

    def test_dashboard_url_handles_both_supabase_domains_and_missing_configuration(self):
        for url, expected in (("https://school123.supabase.co", "https://supabase.com/dashboard/project/school123"),
                              ("https://school123.supabase.in", "https://supabase.com/dashboard/project/school123"),
                              ("", "https://supabase.com/dashboard"), (None, "https://supabase.com/dashboard")):
            with self.subTest(url=url), override_settings(SUPABASE_URL=url):
                self.assertEqual(console._supabase_dashboard_url(), expected)

    def test_unknown_or_internal_model_keys_raise_404(self):
        for key in ("", "accounts", "accounts.missing", "auth.user", "sessions.session", "accounts.user.extra"):
            with self.subTest(key=key), self.assertRaises(Http404):
                console._model_for(key)
        self.assertIs(console._model_for("accounts.user"), User)

    def test_row_redaction_keeps_empty_sensitive_cells_empty(self):
        cols = [{"name": "password", "redacted": True}, {"name": "username", "redacted": False}]
        self.assertEqual(console._row({"password": "hash", "username": "Alice"}, cols),
                         {"password": console.MASK, "username": "Alice"})
        for blank in (None, ""):
            with self.subTest(blank=blank):
                self.assertEqual(console._row({"password": blank}, cols)["password"], blank)


class ConsoleDatabaseOverviewTests(SimpleTestCase):
    def setUp(self):
        self.enterContext(patch.object(console, "connection", SimpleNamespace(vendor="postgresql")))
        self.enterContext(patch.object(console, "_models", return_value=[]))
        self.enterContext(patch.object(console, "_storage_usage", return_value={
            "source": "unavailable", "buckets": [], "truncated": False,
        }))

    @override_settings(SUPABASE_DB_LIMIT_MB="2", SUPABASE_STORAGE_LIMIT_MB="1")
    def test_postgres_server_facts_are_serialized_and_database_usage_is_capped(self):
        started = datetime(2026, 10, 18, 10, 30, tzinfo=timezone.utc)
        with patch.object(console, "_fetch", side_effect=[[(5242880,)], [("17.1 (Ubuntu)",)],
                                                           [(3,)], [(100,)], [(started,)]]) as fetch:
            data = console.AdminDatabaseView().get(None).data
        self.assertEqual(data["database"], {"bytes": 5242880, "mb": 5.0, "limit_mb": 2.0, "percent": 100.0})
        self.assertEqual(data["server"], {"engine": "postgresql", "version": "17.1", "connections": 3,
                         "max_connections": 100, "started_at": "2026-10-18T10:30:00+00:00"})
        self.assertEqual(fetch.call_count, 5)

    @override_settings(SUPABASE_DB_LIMIT_MB="0", SUPABASE_STORAGE_LIMIT_MB="0")
    def test_unavailable_postgres_facts_and_zero_limits_are_safe(self):
        with patch.object(console, "_fetch", return_value=None):
            data = console.AdminDatabaseView().get(None).data
        self.assertEqual(data["database"], {"bytes": None, "mb": None, "limit_mb": 0.0, "percent": None})
        self.assertIsNone(data["storage"]["percent"])
        self.assertEqual(data["server"], {"engine": "postgresql", "version": None, "connections": None,
                         "max_connections": None, "started_at": None})


class ConsoleStorageTests(SimpleTestCase):
    def setUp(self):
        self.available = self.enterContext(patch.object(console, "_storage_objects_available", return_value=False))
        self.storage = self.enterContext(patch.object(console, "default_storage", SimpleNamespace(bucket=None)))

    def test_supabase_usage_takes_precedence_and_converts_database_numbers(self):
        self.available.return_value = True
        with patch.object(console, "_fetch", return_value=[("uploads", 3, 1536), ("forms", 1, 512)]):
            self.assertEqual(console._storage_usage(), {"source": "supabase", "truncated": False, "buckets": [
                {"name": "uploads", "files": 3, "bytes": 1536}, {"name": "forms", "files": 1, "bytes": 512},
            ]})

    def test_empty_supabase_bucket_is_a_successful_zero_usage_result(self):
        self.available.return_value = True
        with patch.object(console, "_fetch", return_value=[]):
            self.assertEqual(console._storage_usage(), {"source": "supabase", "buckets": [], "truncated": False})

    def test_failed_supabase_query_falls_back_to_s3(self):
        self.available.return_value = True
        bucket = Mock()
        bucket.name = "school-files"
        bucket.objects.limit.return_value = [SimpleNamespace(size=100), SimpleNamespace(size=200)]
        self.storage.bucket = bucket
        with patch.object(console, "_fetch", return_value=None):
            self.assertEqual(console._storage_usage(), {"source": "s3", "truncated": False,
                             "buckets": [{"name": "school-files", "files": 2, "bytes": 300}]})
        bucket.objects.limit.assert_called_once_with(5000)

    def test_s3_listing_cap_is_reported_as_truncated(self):
        bucket = Mock()
        bucket.name = "school-files"
        bucket.objects.limit.return_value = [SimpleNamespace(size=2)] * 5000
        self.storage.bucket = bucket
        usage = console._storage_usage()
        self.assertTrue(usage["truncated"])
        self.assertEqual(usage["buckets"], [{"name": "school-files", "files": 5000, "bytes": 10000}])

    def test_s3_listing_failure_returns_unavailable(self):
        bucket = Mock()
        bucket.objects.limit.side_effect = OSError("storage unreachable")
        self.storage.bucket = bucket
        self.assertEqual(console._storage_usage(), {"source": "unavailable", "buckets": [], "truncated": False})

    def test_disk_usage_counts_nested_files_and_empty_files(self):
        with TemporaryDirectory() as root, override_settings(MEDIA_ROOT=root):
            nested = Path(root) / "marksheets"
            nested.mkdir()
            (nested / "one.pdf").write_bytes(b"12345")
            (Path(root) / "empty.txt").write_bytes(b"")
            self.assertEqual(console._storage_usage(), {"source": "disk", "truncated": False,
                             "buckets": [{"name": "media (local disk)", "files": 2, "bytes": 5}]})

    def test_disappearing_disk_files_are_skipped(self):
        with TemporaryDirectory() as root, override_settings(MEDIA_ROOT=root):
            (Path(root) / "gone.pdf").write_bytes(b"gone")
            with patch.object(console.os.path, "getsize", side_effect=OSError("file removed")):
                usage = console._storage_usage()
            self.assertEqual(usage["source"], "disk")
            self.assertEqual(usage["buckets"][0]["files"], 0)
            self.assertEqual(usage["buckets"][0]["bytes"], 0)

    @override_settings(MEDIA_ROOT="")
    def test_missing_storage_returns_unavailable(self):
        self.assertEqual(console._storage_usage(), {"source": "unavailable", "buckets": [], "truncated": False})

    def test_storage_rows_parameterize_search_and_serialize_upload_dates(self):
        request = SimpleNamespace(query_params={"q": "  ' OR 1=1 --  "})
        uploaded = datetime(2026, 10, 18, tzinfo=timezone.utc)
        self.available.return_value = True
        with patch.object(console, "_fetch", side_effect=[[(3,)], [("forms/one.pdf", "uploads", 128, "application/pdf", uploaded, None)]]) as fetch:
            data = console.AdminDataRowsView()._storage(request, 2, 1).data
        self.assertEqual((data["count"], data["pages"], data["page"]), (3, 3, 2))
        self.assertEqual(data["results"], [{"name": "forms/one.pdf", "bucket_id": "uploads", "size": 128,
                         "mimetype": "application/pdf", "created_at": "2026-10-18T00:00:00+00:00", "updated_at": None}])
        for call in fetch.call_args_list:
            self.assertNotIn("OR 1=1", call.args[0])
        self.assertEqual(fetch.call_args_list[0].args[1], ["%' OR 1=1 --%"])
        self.assertEqual(fetch.call_args_list[1].args[1], ["%' OR 1=1 --%", 1, 1])

    def test_storage_rows_return_404_for_unavailable_or_failed_queries(self):
        request = SimpleNamespace(query_params={})
        with self.assertRaises(Http404):
            console.AdminDataRowsView()._storage(request, 1, 25)
        self.available.return_value = True
        for results in ([None, []], [[(0,)], None]):
            with self.subTest(results=results), patch.object(console, "_fetch", side_effect=results):
                with self.assertRaises(Http404):
                    console.AdminDataRowsView()._storage(request, 1, 25)


class ConsoleDataRegressionTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.make_admin()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.alice = self.make_user("alice", Role.STUDENT, full_name="Alice Example")
        self.bob = self.make_user("bob", Role.STUDENT, full_name="Bob Example")

    def test_failed_read_query_does_not_poison_the_callers_transaction(self):
        self.assertIsNone(console._fetch("SELECT * FROM tvv_missing_table"))
        self.assertEqual(User.objects.count(), 3)
        self.assertEqual(console._fetch("SELECT 1"), [(1,)])

    def test_password_hash_is_not_searchable(self):
        User.objects.filter(pk=self.alice.pk).update(password="secret-marker-that-only-occurs-in-the-hash")
        res = self.client.get("/api/auth/admin/data/accounts.user/", {"q": "secret-marker-that-only-occurs"})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((res.data["count"], res.data["results"]), (0, []))

    def test_pagination_has_no_overlap_and_out_of_range_page_is_empty(self):
        pages = [self.client.get("/api/auth/admin/data/accounts.user/", {"ordering": "username", "page_size": 1, "page": page})
                 for page in (1, 2, 3, 4)]
        for res in pages:
            self.assertEqual(res.status_code, 200, res.data)
            self.assertEqual((res.data["count"], res.data["pages"]), (3, 3))
        self.assertEqual([res.data["results"][0]["username"] for res in pages[:3]], ["alice", "bob", self.admin.username])
        self.assertEqual(pages[3].data["results"], [])

    def test_empty_search_result_still_has_one_page(self):
        res = self.client.get("/api/auth/admin/data/accounts.user/", {"q": "not-a-school-user"})
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((res.data["count"], res.data["pages"], res.data["results"]), (0, 1, []))

    def test_secret_and_invalid_sort_fields_use_the_actual_default_order(self):
        baseline = self.client.get("/api/auth/admin/data/accounts.user/").data["results"]
        for ordering in ("password", "-password", "username__password", "not_a_field"):
            with self.subTest(ordering=ordering):
                res = self.client.get("/api/auth/admin/data/accounts.user/", {"ordering": ordering})
                self.assertEqual(res.status_code, 200, res.data)
                self.assertEqual(res.data["results"], baseline)

    def test_csv_export_applies_search_ordering_escaping_and_redaction(self):
        self.alice.full_name = '@SUM(1,2), "quoted"\nশিক্ষা'
        self.alice.save()
        res = self.client.get("/api/auth/admin/data/accounts.user/export/", {"q": "Example", "ordering": "-username"})
        self.assertEqual(res.status_code, 200)
        rows = list(csv.DictReader(io.StringIO(res.content.decode())))
        # Alice no longer matches "Example"; exporting a search must not include unrelated accounts.
        self.assertEqual([row["username"] for row in rows], ["bob"])
        res = self.client.get("/api/auth/admin/data/accounts.user/export/", {"ordering": "-username"})
        rows = list(csv.DictReader(io.StringIO(res.content.decode())))
        self.assertEqual([row["username"] for row in rows], [self.admin.username, "bob", "alice"])
        self.assertEqual(rows[-1]["full_name"], "'" + self.alice.full_name)
        self.assertTrue(all(row["password"] == console.MASK for row in rows))
        self.assertNotIn(self.alice.password, res.content.decode())
        self.assertEqual(res["Cache-Control"], "no-store")

    def test_console_endpoints_are_read_only_even_for_super_admin(self):
        before = list(User.objects.values().order_by("pk"))
        for path in ("database/", "data/", "data/accounts.user/", "data/accounts.user/export/"):
            for method in ("post", "patch", "delete"):
                with self.subTest(path=path, method=method):
                    res = getattr(self.client, method)("/api/auth/admin/" + path, {"username": "changed"}, format="json")
                    self.assertEqual(res.status_code, 405, res.data)
        self.assertEqual(list(User.objects.values().order_by("pk")), before)

    @override_settings(SUPABASE_DB_LIMIT_MB="1", SUPABASE_STORAGE_LIMIT_MB="2")
    def test_database_overview_aggregates_buckets_and_caps_percentages(self):
        usage = {"source": "s3", "truncated": True, "buckets": [
            {"name": "uploads", "files": 3, "bytes": 2 * 1024 * 1024},
            {"name": "forms", "files": 1, "bytes": 1024 * 1024},
        ]}
        with patch.object(console, "_storage_usage", return_value=usage):
            res = self.client.get("/api/auth/admin/database/")
        self.assertEqual(res.status_code, 200, res.data)
        storage = res.data["storage"]
        self.assertEqual((storage["files"], storage["bytes"], storage["mb"], storage["percent"]), (4, 3145728, 3.0, 100.0))
        self.assertTrue(storage["truncated"])
        self.assertEqual(storage["limit_mb"], 2.0)
        self.assertEqual([bucket["mb"] for bucket in storage["buckets"]], [2.0, 1.0])
        self.assertEqual(res.data["totals"]["rows"], sum(table["rows"] for table in res.data["tables"]))
