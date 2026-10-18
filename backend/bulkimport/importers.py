"""
One class per kind of data the Super Admin can bulk-import from Excel / CSV.

Every importer follows the same two steps:
  validate(row)  -> checks ONE row and says what would happen (create / update / skip) or what is wrong.
                    Never writes anything. This powers the "check before you confirm" preview.
  commit(rows)   -> writes the rows that passed validation (the view wraps it in a transaction).

Rows are always re-validated against the live database right before they are written, so the preview can
never drift from what is saved. Lookups (classes, subjects, students…) are loaded once, not once per row.
"""
import re
import secrets
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from functools import cached_property

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils import timezone

from academics.models import (
    AcademicSession,
    Attendance,
    Exam,
    Result,
    SchoolClass,
    StudentProfile,
    Subject,
    TeacherAttendance,
    TeacherProfile,
    TimetableEntry,
)
from accounts.models import Role, User
from content.models import Event
from notices.serializers import sanitize

from .parsing import norm

_USERNAME = re.compile(r"^[\w.@+-]{3,150}$")
_PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"  # no 0/O/1/l/I: easy to read out loud


@dataclass
class Column:
    key: str
    label: str
    required: bool = False
    help: str = ""
    aliases: tuple = ()


@dataclass
class RowResult:
    row: int
    data: dict = field(default_factory=dict)  # cleaned values used by commit()
    display: dict = field(default_factory=dict)  # what the preview table shows (never contains passwords)
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    action: str = "create"  # create | update | skip

    @property
    def ok(self):
        return not self.errors


# ───────────────────────── small parsers ─────────────────────────
def parse_date(text):
    text = (text or "").strip()
    for fmt, size in (("%Y-%m-%d", 10), ("%d/%m/%Y", 10), ("%d-%m-%Y", 10), ("%d.%m.%Y", 10)):
        try:
            return datetime.strptime(text[:size] if fmt == "%Y-%m-%d" else text, fmt).date()
        except ValueError:
            continue
    return None


def parse_time(text):
    text = (text or "").strip().upper().replace(".", "")
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p", "%I %p", "%I%p"):
        try:
            return datetime.strptime(text, fmt).time().replace(second=0, microsecond=0)
        except ValueError:
            continue
    return None


def parse_status(text):
    t = (text or "").strip().upper()
    if t in ("P", "PRESENT", "1", "Y", "YES"):
        return "PRESENT"
    if t in ("A", "ABSENT", "0", "N", "NO"):
        return "ABSENT"
    return None


_DAYS = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5}


def parse_weekday(text):
    t = (text or "").strip().lower()
    if t[:3] in _DAYS:
        return _DAYS[t[:3]]
    if t.isdigit() and 1 <= int(t) <= 6:
        return int(t) - 1  # 1 = Monday … 6 = Saturday
    return None


def parse_decimal(text):
    try:
        d = Decimal((text or "").strip())
    except InvalidOperation:
        return None
    return d if d.is_finite() else None


def generate_password(user=None):
    """A strong, readable password that passes the project's own validators."""
    while True:
        pw = "".join(secrets.choice(_PW_ALPHABET) for _ in range(12))
        try:
            validate_password(pw, user=user)
            return pw
        except DjangoValidationError:
            continue


def _plain(v):
    return sanitize((v or "").strip())


# ───────────────────────── shared lookups (loaded once per request) ─────────────────────────
class Lookups:
    @cached_property
    def current_session(self):
        return AcademicSession.objects.filter(is_current=True).first()

    @cached_property
    def sessions(self):
        return {s.label.lower(): s for s in AcademicSession.objects.all()}

    @cached_property
    def classes(self):
        return {(c.session_id, c.name.lower(), (c.stream or "").lower()): c for c in SchoolClass.objects.all()}

    @cached_property
    def subjects(self):
        return {(s.school_class_id, s.name.lower()): s for s in Subject.objects.all()}

    @cached_property
    def students(self):
        qs = StudentProfile.objects.filter(user__is_active_account=True).select_related("user", "school_class")
        return {sp.user.username: sp for sp in qs}

    @cached_property
    def teachers(self):
        return {u.username: u for u in User.objects.filter(role=Role.TEACHER, is_active_account=True)}

    @cached_property
    def usernames(self):
        return set(u.lower() for u in User.objects.values_list("username", flat=True))

    def session_for(self, label):
        if label:
            s = self.sessions.get(label.strip().lower())
            return (s, None) if s else (None, f"Session “{label}” does not exist.")
        if self.current_session:
            return self.current_session, None
        return None, "No current session is set. Create one under Classes & Subjects, or fill the “session” column."

    def find_class(self, name, stream="", session_label=""):
        session, err = self.session_for(session_label)
        if err:
            return None, err
        found = self.classes.get((session.id, name.strip().lower(), (stream or "").strip().lower()))
        if found:
            return found, None
        label = f"{name} {stream}".strip()
        return None, f"Class “{label}” was not found in session {session.label}. Create it first (or import classes)."


# ───────────────────────── base class ─────────────────────────
class Importer:
    key = ""
    title = ""
    description = ""
    columns: tuple = ()
    samples: tuple = ()  # example rows, each a dict keyed by column key
    notes: tuple = ()
    chunk_size = 500  # rows saved per request; accounts are smaller because password hashing is slow

    def __init__(self, user):
        self.user = user
        self.L = Lookups()

    def prepare(self, rows):  # rows: list of {column key: text}. Preload what validation needs, in bulk.
        pass

    def validate(self, row_no, raw) -> RowResult:  # pragma: no cover - implemented by subclasses
        raise NotImplementedError

    def commit(self, results) -> dict:  # pragma: no cover
        raise NotImplementedError

    # helpers
    def new(self, row_no, raw):
        return RowResult(row=row_no, display={k: v for k, v in raw.items() if v != "" and k != "password"})

    def need(self, r, raw, *keys):
        for k in keys:
            if not raw.get(k):
                col = next(c.label for c in self.columns if c.key == k)
                r.errors.append(f"“{col}” is required.")


def _account_columns(extra):
    return (
        Column("full_name", "Full name", True, "The person's name as it should appear everywhere.", ("name",)),
        Column("username", "Username", True, "Their login name. At least 3 characters, no spaces. Must be new.", ("login", "userid")),
        Column("password", "Password", False, "Leave empty and a strong password is generated for you (you can download the list once, after importing).", ()),
    ) + extra


class _AccountImporter(Importer):
    chunk_size = 12  # PBKDF2 hashing takes ~0.3 s per account on a small server

    def prepare(self, rows):
        self._seen = set()

    def check_account(self, r, raw):
        self.need(r, raw, "full_name", "username")
        name, username, pw = raw["full_name"], raw["username"], raw.get("password", "")
        if name and len(name) > 150:
            r.errors.append("Full name is too long (max 150 characters).")
        if username:
            if not _USERNAME.match(username):
                r.errors.append("Username must be 3+ characters: letters, numbers and . _ @ + - only (no spaces).")
            elif username.lower() in self.L.usernames:
                r.errors.append(f"Username “{username}” already exists.")
            elif username.lower() in self._seen:
                r.errors.append(f"Username “{username}” appears twice in this file.")
            self._seen.add(username.lower())
        if pw:
            try:
                validate_password(pw, user=User(username=username or "x", full_name=name))
            except DjangoValidationError as e:
                r.errors.append("Password: " + " ".join(e.messages))
        if raw.get("phone") and len(raw["phone"]) > 20:
            r.errors.append("Phone is too long (max 20 characters).")
        if raw.get("email"):
            try:
                validate_email(raw["email"])
            except DjangoValidationError:
                r.errors.append("E-mail address is not valid.")
        r.data.update(full_name=name, username=username, password=pw, phone=raw.get("phone", ""), email=raw.get("email", ""))
        r.display["password"] = "provided" if pw else "auto-generated"

    def make_user(self, d, role):
        user = User(username=d["username"], full_name=d["full_name"], role=role, phone=d["phone"], email=d["email"], must_change_password=False)
        generated = not d["password"]
        pw = d["password"] or generate_password(user)
        user.set_password(pw)
        user.save()  # the post_save signal creates the empty Student/Teacher profile
        return user, (pw if generated else None)


# ───────────────────────── accounts ─────────────────────────
class StudentsImporter(_AccountImporter):
    key = "students"
    title = "Student accounts"
    description = "Create many student logins at once, with class, roll number and guardian details."
    columns = _account_columns((
        Column("class", "Class", False, "Class name exactly as in Classes & Subjects, e.g. Class XI. The class must already exist.", ("classname", "standard")),
        Column("stream", "Stream", False, "e.g. Science or Arts. Leave empty if the class has no stream."),
        Column("session", "Session", False, "e.g. 2025-2026. Leave empty to use the current session."),
        Column("roll_number", "Roll number", False, "Up to 20 characters.", ("roll", "rollno")),
        Column("guardian_name", "Guardian name", False, "", ("guardian", "parentname")),
        Column("guardian_contact", "Guardian contact", False, "Phone number, up to 20 characters.", ("guardianphone", "parentphone")),
        Column("phone", "Phone", False, "Student's own phone, optional."),
        Column("email", "Email", False, "Optional."),
    ))
    samples = (
        {"full_name": "Aarav Sen", "username": "aarav.sen", "password": "", "class": "Class XI", "stream": "Science", "session": "", "roll_number": "1", "guardian_name": "Rahul Sen", "guardian_contact": "9000000001", "phone": "", "email": ""},
        {"full_name": "Diya Das", "username": "diya.das", "password": "", "class": "Class XI", "stream": "Science", "session": "", "roll_number": "2", "guardian_name": "Mitali Das", "guardian_contact": "9000000002", "phone": "", "email": ""},
        {"full_name": "Imran Ali", "username": "imran.ali", "password": "", "class": "Class XI", "stream": "Arts", "session": "", "roll_number": "1", "guardian_name": "Salim Ali", "guardian_contact": "9000000003", "phone": "", "email": ""},
    )
    notes = (
        "Delete the 3 example rows before you add your own students.",
        "Leave Password empty to get strong passwords generated. After the import you can download the list ONCE — it is not stored anywhere.",
        "If you type passwords, they must be at least 10 characters and not common (like 12345678).",
        "A student without a class can be given one later from the Students page.",
    )

    def prepare(self, rows):
        super().prepare(rows)
        self._rolls = set()

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.check_account(r, raw)
        klass = None
        if raw.get("stream") and not raw.get("class"):
            r.errors.append("Stream is filled but Class is empty.")
        if raw.get("class"):
            klass, err = self.L.find_class(raw["class"], raw.get("stream", ""), raw.get("session", ""))
            if err:
                r.errors.append(err)
        elif not r.errors:
            r.warnings.append("No class — assign one later from the Students page.")
        for key, limit in (("roll_number", 20), ("guardian_name", 150), ("guardian_contact", 20)):
            if len(raw.get(key, "")) > limit:
                r.errors.append(f"{key.replace('_', ' ').capitalize()} is too long (max {limit}).")
        if klass and raw.get("roll_number"):
            token = (klass.id, raw["roll_number"].lower())
            if token in self._rolls:
                r.warnings.append(f"Roll number {raw['roll_number']} is used twice for this class in the file.")
            self._rolls.add(token)
        r.data.update(school_class=klass, roll_number=raw.get("roll_number", ""), guardian_name=_plain(raw.get("guardian_name", "")), guardian_contact=raw.get("guardian_contact", ""))
        r.display["class"] = str(klass) if klass else ""
        return r

    def commit(self, results):
        credentials = []
        for r in results:
            d = r.data
            user, pw = self.make_user(d, Role.STUDENT)
            sp = StudentProfile.objects.get(user=user)
            sp.school_class, sp.roll_number = d["school_class"], d["roll_number"]
            sp.guardian_name, sp.guardian_contact = d["guardian_name"], d["guardian_contact"]
            sp.save()
            if pw:
                credentials.append({"username": user.username, "full_name": user.full_name, "password": pw})
        return {"created": len(results), "credentials": credentials}


class TeachersImporter(_AccountImporter):
    key = "teachers"
    title = "Teacher accounts"
    description = "Create many teacher logins at once, with department and experience."
    columns = _account_columns((
        Column("department", "Department", False, "e.g. Physics. Shown on the public Faculty page.", ("subject",)),
        Column("years_experience", "Years of experience", False, "A whole number, 0–60.", ("experience", "years")),
        Column("phone", "Phone", False, "Optional, up to 20 characters."),
        Column("email", "Email", False, "Optional."),
    ))
    samples = (
        {"full_name": "Sunita Roy", "username": "sunita.roy", "password": "", "department": "Physics", "years_experience": "12", "phone": "", "email": ""},
        {"full_name": "Arup Ghosh", "username": "arup.ghosh", "password": "", "department": "History", "years_experience": "8", "phone": "", "email": ""},
        {"full_name": "Meera Pal", "username": "meera.pal", "password": "", "department": "English", "years_experience": "5", "phone": "", "email": ""},
    )
    notes = ("Delete the 3 example rows first.", "Leave Password empty to get strong passwords generated; download the list once after importing.")

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.check_account(r, raw)
        years = None
        if raw.get("years_experience"):
            if raw["years_experience"].isdigit() and 0 <= int(raw["years_experience"]) <= 60:
                years = int(raw["years_experience"])
            else:
                r.errors.append("Years of experience must be a whole number between 0 and 60.")
        if len(raw.get("department", "")) > 100:
            r.errors.append("Department is too long (max 100).")
        r.data.update(department=_plain(raw.get("department", "")), years=years)
        return r

    def commit(self, results):
        credentials = []
        for r in results:
            d = r.data
            user, pw = self.make_user(d, Role.TEACHER)
            tp = TeacherProfile.objects.get(user=user)
            tp.department, tp.years_experience = d["department"], d["years"]
            tp.save()
            if pw:
                credentials.append({"username": user.username, "full_name": user.full_name, "password": pw})
        return {"created": len(results), "credentials": credentials}


# ───────────────────────── classes & subjects ─────────────────────────
class ClassesImporter(Importer):
    key = "classes"
    title = "Classes"
    description = "Add classes (and streams) to a session."
    columns = (
        Column("name", "Class", True, "e.g. Class XI", ("classname", "standard")),
        Column("stream", "Stream", False, "e.g. Science. Leave empty if none."),
        Column("session", "Session", False, "e.g. 2025-2026. Leave empty to use the current session."),
    )
    samples = ({"name": "Class XI", "stream": "Science", "session": ""}, {"name": "Class XI", "stream": "Arts", "session": ""}, {"name": "Class XII", "stream": "Science", "session": ""})
    notes = ("The session must already exist (create it under Classes & Subjects).", "A class that already exists is skipped, so it is safe to upload the same file twice.")

    def prepare(self, rows):
        self._seen = set()

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.need(r, raw, "name")
        if len(raw.get("name", "")) > 50 or len(raw.get("stream", "")) > 20:
            r.errors.append("Class name (max 50) or stream (max 20) is too long.")
        session, err = self.L.session_for(raw.get("session", ""))
        if err:
            r.errors.append(err)
        if r.errors:
            return r
        token = (session.id, raw["name"].lower(), raw.get("stream", "").lower())
        if token in self._seen:
            r.errors.append("This class appears twice in the file.")
        elif token in self.L.classes:
            r.action = "skip"
            r.warnings.append("Already exists — will be skipped.")
        self._seen.add(token)
        r.data.update(name=_plain(raw["name"]), stream=_plain(raw.get("stream", "")), session=session)
        return r

    def commit(self, results):
        made = 0
        for r in results:
            if r.action == "skip":
                continue
            SchoolClass.objects.create(**r.data)
            made += 1
        return {"created": made, "skipped": len(results) - made}


class SubjectsImporter(Importer):
    key = "subjects"
    title = "Subjects"
    description = "Add subjects to classes."
    columns = (
        Column("name", "Subject", True, "e.g. Physics", ("subjectname",)),
        Column("class", "Class", True, "The class this subject belongs to. It must already exist.", ("classname",)),
        Column("stream", "Stream", False, "e.g. Science. Leave empty if the class has no stream."),
        Column("session", "Session", False, "Leave empty to use the current session."),
    )
    samples = ({"name": "Physics", "class": "Class XI", "stream": "Science", "session": ""}, {"name": "Chemistry", "class": "Class XI", "stream": "Science", "session": ""}, {"name": "History", "class": "Class XI", "stream": "Arts", "session": ""})
    notes = ("A subject that already exists in that class is skipped.",)

    def prepare(self, rows):
        self._seen = set()

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.need(r, raw, "name", "class")
        if len(raw.get("name", "")) > 100:
            r.errors.append("Subject name is too long (max 100).")
        if r.errors:
            return r
        klass, err = self.L.find_class(raw["class"], raw.get("stream", ""), raw.get("session", ""))
        if err:
            r.errors.append(err)
            return r
        token = (klass.id, raw["name"].lower())
        if token in self._seen:
            r.errors.append("This subject appears twice for the same class.")
        elif token in self.L.subjects:
            r.action = "skip"
            r.warnings.append("Already exists — will be skipped.")
        self._seen.add(token)
        r.data.update(name=_plain(raw["name"]), school_class=klass)
        r.display["class"] = str(klass)
        return r

    def commit(self, results):
        made = 0
        for r in results:
            if r.action == "skip":
                continue
            Subject.objects.create(**r.data)
            made += 1
        return {"created": made, "skipped": len(results) - made}


# ───────────────────────── results ─────────────────────────
class ResultsImporter(Importer):
    key = "results"
    title = "Results (marks)"
    description = "Enter marks for many students and subjects. Saving again updates the same marks."
    columns = (
        Column("username", "Student username", True, "The student's login name.", ("student", "studentusername")),
        Column("subject", "Subject", True, "Subject name exactly as in the student's class."),
        Column("marks", "Marks obtained", True, "A number, e.g. 78 or 78.5.", ("marksobtained", "obtained")),
        Column("full_marks", "Full marks", False, "Default 100.", ("outof", "total", "maxmarks")),
        Column("session", "Session", False, "Leave empty to use the current session."),
    )
    samples = (
        {"username": "aarav.sen", "subject": "Physics", "marks": "78", "full_marks": "100", "session": ""},
        {"username": "aarav.sen", "subject": "Chemistry", "marks": "84.5", "full_marks": "100", "session": ""},
        {"username": "diya.das", "subject": "Physics", "marks": "91", "full_marks": "100", "session": ""},
    )
    notes = ("The student must have a class, and the subject must belong to that class.", "If marks already exist for that student + subject + session they are updated.")

    def prepare(self, rows):
        self._seen = set()
        self._existing = set(Result.objects.values_list("student_id", "subject_id", "session_id"))

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.need(r, raw, "username", "subject", "marks")
        if r.errors:
            return r
        sp = self.L.students.get(raw["username"])
        if not sp:
            r.errors.append(f"No active student with username “{raw['username']}”.")
        elif not sp.school_class_id:
            r.errors.append("This student has no class yet.")
        subject = self.L.subjects.get((sp.school_class_id, raw["subject"].lower())) if sp and sp.school_class_id else None
        if sp and sp.school_class_id and not subject:
            r.errors.append(f"Subject “{raw['subject']}” was not found in {sp.school_class}.")
        session, err = self.L.session_for(raw.get("session", ""))
        if err:
            r.errors.append(err)
        marks, full = parse_decimal(raw["marks"]), parse_decimal(raw.get("full_marks") or "100")
        if marks is None or full is None:
            r.errors.append("Marks and full marks must be numbers.")
        else:
            if marks < 0 or full <= 0 or full > Decimal("999.99"):
                r.errors.append("Marks cannot be negative; full marks must be between 1 and 999.99.")
            elif marks > full:
                r.errors.append(f"Marks ({marks}) are more than full marks ({full}).")
            if marks != marks.quantize(Decimal("0.01")) or full != full.quantize(Decimal("0.01")):
                r.errors.append("Use at most 2 decimal places.")
        if r.errors:
            return r
        token = (sp.pk, subject.pk, session.pk)
        if token in self._seen:
            r.errors.append("This student + subject appears twice in the file.")
            return r
        self._seen.add(token)
        if token in self._existing:
            r.action = "update"
            r.warnings.append("Marks already exist — they will be replaced.")
        r.data.update(student=sp, subject=subject, session=session, marks=marks, full=full)
        r.display.update(subject=subject.name, full_marks=str(full))
        return r

    def commit(self, results):
        made = upd = 0
        for r in results:
            d = r.data
            _, created = Result.objects.update_or_create(
                student=d["student"], subject=d["subject"], session=d["session"],
                defaults={"marks_obtained": d["marks"], "full_marks": d["full"], "recorded_by": self.user},
            )
            made, upd = made + created, upd + (not created)
        return {"created": made, "updated": upd}


# ───────────────────────── attendance ─────────────────────────
class _AttendanceImporter(Importer):
    columns = ()

    def prepare(self, rows):
        self._seen = set()
        dates = {d for d in (parse_date(x.get("date", "")) for x in rows) if d}
        self._existing = self.load_existing(dates)

    def load_existing(self, dates):  # pragma: no cover
        raise NotImplementedError

    def person(self, username):  # pragma: no cover
        raise NotImplementedError

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.need(r, raw, "username", "date", "status")
        if r.errors:
            return r
        who = self.person(raw["username"])
        if not who:
            r.errors.append(f"No active {self.who_noun} with username “{raw['username']}”.")
        day, status = parse_date(raw["date"]), parse_status(raw["status"])
        if not day:
            r.errors.append("Date not understood. Use YYYY-MM-DD or DD/MM/YYYY.")
        elif day > timezone.localdate():
            r.errors.append("Attendance cannot be recorded for a future date.")
        if not status:
            r.errors.append("Status must be P / Present or A / Absent.")
        if r.errors:
            return r
        token = (who.pk, day)
        if token in self._seen:
            r.errors.append("This person + date appears twice in the file.")
            return r
        self._seen.add(token)
        if token in self._existing:
            r.action = "update"
            r.warnings.append("Already marked for that day — will be updated.")
        r.data.update(who=who, day=day, status=status)
        r.display.update(date=day.isoformat(), status=status.title())
        return r


class AttendanceImporter(_AttendanceImporter):
    key = "attendance"
    title = "Student attendance"
    description = "Mark many students present or absent over many days."
    who_noun = "student"
    columns = (
        Column("username", "Student username", True, "The student's login name.", ("student",)),
        Column("date", "Date", True, "YYYY-MM-DD or DD/MM/YYYY. Not in the future.", ("day",)),
        Column("status", "Status", True, "P or Present, A or Absent.", ("attendance", "mark")),
    )
    samples = (
        {"username": "aarav.sen", "date": "2026-10-12", "status": "P"},
        {"username": "diya.das", "date": "2026-10-12", "status": "A"},
        {"username": "aarav.sen", "date": "2026-10-13", "status": "P"},
    )
    notes = ("One row per student per day.", "A day that is already marked is updated with the new value.")

    def load_existing(self, dates):
        return set(Attendance.objects.filter(date__in=dates).values_list("student_id", "date"))

    def person(self, username):
        return self.L.students.get(username)

    def commit(self, results):
        made = upd = 0
        for r in results:
            _, created = Attendance.objects.update_or_create(student=r.data["who"], date=r.data["day"], defaults={"status": r.data["status"], "marked_by": self.user})
            made, upd = made + created, upd + (not created)
        return {"created": made, "updated": upd}


class TeacherAttendanceImporter(_AttendanceImporter):
    key = "teacher_attendance"
    title = "Teacher attendance"
    description = "Mark many teachers present or absent over many days."
    who_noun = "teacher"
    columns = (
        Column("username", "Teacher username", True, "The teacher's login name.", ("teacher",)),
        Column("date", "Date", True, "YYYY-MM-DD or DD/MM/YYYY. Not in the future.", ("day",)),
        Column("status", "Status", True, "P or Present, A or Absent.", ("attendance", "mark")),
    )
    samples = (
        {"username": "sunita.roy", "date": "2026-10-12", "status": "P"},
        {"username": "arup.ghosh", "date": "2026-10-12", "status": "A"},
        {"username": "sunita.roy", "date": "2026-10-13", "status": "P"},
    )
    notes = ("One row per teacher per day.",)

    def load_existing(self, dates):
        return set(TeacherAttendance.objects.filter(date__in=dates).values_list("teacher_id", "date"))

    def person(self, username):
        return self.L.teachers.get(username)

    def commit(self, results):
        made = upd = 0
        for r in results:
            _, created = TeacherAttendance.objects.update_or_create(teacher=r.data["who"], date=r.data["day"], defaults={"status": r.data["status"], "marked_by": self.user})
            made, upd = made + created, upd + (not created)
        return {"created": made, "updated": upd}


# ───────────────────────── events, exams, timetable ─────────────────────────
class EventsImporter(Importer):
    key = "events"
    title = "Events"
    description = "Add many events to the school calendar."
    columns = (
        Column("title", "Title", True, "Up to 200 characters."),
        Column("date", "Date", True, "YYYY-MM-DD or DD/MM/YYYY.", ("eventdate",)),
        Column("audience", "Audience", False, "e.g. All classes."),
        Column("description", "Description", False, "Plain text."),
    )
    samples = (
        {"title": "Annual Sports Day", "date": "2026-12-05", "audience": "All classes", "description": "Track and field events on the school ground."},
        {"title": "Science Exhibition", "date": "2027-01-20", "audience": "Class IX–XII", "description": ""},
        {"title": "Republic Day Celebration", "date": "2027-01-26", "audience": "Everyone", "description": ""},
    )
    notes = ("An event with the same title on the same date is skipped.",)

    def prepare(self, rows):
        self._seen = set()
        self._existing = {(t.lower(), d) for t, d in Event.objects.values_list("title", "event_date")}

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.need(r, raw, "title", "date")
        day = parse_date(raw.get("date", ""))
        if raw.get("date") and not day:
            r.errors.append("Date not understood. Use YYYY-MM-DD or DD/MM/YYYY.")
        if len(raw.get("title", "")) > 200 or len(raw.get("audience", "")) > 100:
            r.errors.append("Title (max 200) or audience (max 100) is too long.")
        if r.errors:
            return r
        title = _plain(raw["title"])
        token = (title.lower(), day)
        if token in self._seen:
            r.errors.append("This event appears twice in the file.")
            return r
        self._seen.add(token)
        if token in self._existing:
            r.action = "skip"
            r.warnings.append("Already on the calendar — will be skipped.")
        r.data.update(title=title, event_date=day, audience=_plain(raw.get("audience", "")), description=_plain(raw.get("description", "")))
        r.display["date"] = day.isoformat()
        return r

    def commit(self, results):
        made = 0
        for r in results:
            if r.action == "skip":
                continue
            Event.objects.create(created_by=self.user, **r.data)
            made += 1
        return {"created": made, "skipped": len(results) - made}


class ExamsImporter(Importer):
    key = "exams"
    title = "Exam schedule"
    description = "Add many exam dates at once."
    columns = (
        Column("name", "Exam name", True, "e.g. Half-yearly Examination", ("exam", "examname")),
        Column("class", "Class", True, "An existing class.", ("classname",)),
        Column("stream", "Stream", False, "Leave empty if the class has no stream."),
        Column("subject", "Subject", True, "A subject of that class."),
        Column("date", "Date", True, "YYYY-MM-DD or DD/MM/YYYY.", ("examdate",)),
        Column("start_time", "Start time", False, "e.g. 10:30 or 10:30 AM.", ("time",)),
        Column("room", "Room", False, ""),
        Column("session", "Session", False, "Leave empty to use the current session."),
    )
    samples = (
        {"name": "Half-yearly Examination", "class": "Class XI", "stream": "Science", "subject": "Physics", "date": "2026-12-10", "start_time": "10:30", "room": "Hall 1", "session": ""},
        {"name": "Half-yearly Examination", "class": "Class XI", "stream": "Science", "subject": "Chemistry", "date": "2026-12-12", "start_time": "10:30", "room": "Hall 1", "session": ""},
        {"name": "Half-yearly Examination", "class": "Class XI", "stream": "Arts", "subject": "History", "date": "2026-12-10", "start_time": "10:30", "room": "Hall 2", "session": ""},
    )
    notes = ("An identical exam (same class, subject, name, date) is skipped.",)

    def prepare(self, rows):
        self._seen = set()
        self._existing = {(c, s, n.lower(), d) for c, s, n, d in Exam.objects.values_list("school_class_id", "subject_id", "name", "date")}

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.need(r, raw, "name", "class", "subject", "date")
        if r.errors:
            return r
        klass, err = self.L.find_class(raw["class"], raw.get("stream", ""), raw.get("session", ""))
        if err:
            r.errors.append(err)
        subject = self.L.subjects.get((klass.id, raw["subject"].lower())) if klass else None
        if klass and not subject:
            r.errors.append(f"Subject “{raw['subject']}” was not found in {klass}.")
        day = parse_date(raw["date"])
        if not day:
            r.errors.append("Date not understood. Use YYYY-MM-DD or DD/MM/YYYY.")
        start = parse_time(raw["start_time"]) if raw.get("start_time") else None
        if raw.get("start_time") and not start:
            r.errors.append("Start time not understood. Use e.g. 10:30 or 10:30 AM.")
        if len(raw["name"]) > 100 or len(raw.get("room", "")) > 30:
            r.errors.append("Exam name (max 100) or room (max 30) is too long.")
        if r.errors:
            return r
        name = _plain(raw["name"])
        token = (klass.id, subject.id, name.lower(), day)
        if token in self._seen:
            r.errors.append("This exam appears twice in the file.")
            return r
        self._seen.add(token)
        if token in self._existing:
            r.action = "skip"
            r.warnings.append("Already scheduled — will be skipped.")
        r.data.update(name=name, school_class=klass, subject=subject, date=day, start_time=start, room=_plain(raw.get("room", "")))
        r.display.update(**{"class": str(klass), "date": day.isoformat()})
        return r

    def commit(self, results):
        made = 0
        for r in results:
            if r.action == "skip":
                continue
            Exam.objects.create(created_by=self.user, **r.data)
            made += 1
        return {"created": made, "skipped": len(results) - made}


class TimetableImporter(Importer):
    key = "timetable"
    title = "Timetable periods"
    description = "Build a class's weekly timetable from a sheet."
    columns = (
        Column("class", "Class", True, "An existing class.", ("classname",)),
        Column("stream", "Stream", False, "Leave empty if the class has no stream."),
        Column("day", "Day", True, "Monday … Saturday (or 1 = Monday … 6 = Saturday).", ("weekday",)),
        Column("period", "Period", True, "Period number: 1, 2, 3 …", ("periodno",)),
        Column("start_time", "Start time", True, "e.g. 10:00 or 10:00 AM."),
        Column("end_time", "End time", True, "After the start time."),
        Column("subject", "Subject", False, "A subject of that class. Leave empty for a break/assembly and fill Label."),
        Column("label", "Label", False, "e.g. Break, Assembly. Needed when there is no subject."),
        Column("teacher", "Teacher username", False, "An active teacher account."),
        Column("room", "Room", False, ""),
        Column("session", "Session", False, "Leave empty to use the current session."),
    )
    samples = (
        {"class": "Class XI", "stream": "Science", "day": "Monday", "period": "1", "start_time": "10:00", "end_time": "10:45", "subject": "Physics", "label": "", "teacher": "sunita.roy", "room": "11-A", "session": ""},
        {"class": "Class XI", "stream": "Science", "day": "Monday", "period": "2", "start_time": "10:45", "end_time": "11:30", "subject": "Chemistry", "label": "", "teacher": "", "room": "11-A", "session": ""},
        {"class": "Class XI", "stream": "Science", "day": "Monday", "period": "3", "start_time": "11:30", "end_time": "11:50", "subject": "", "label": "Break", "teacher": "", "room": "", "session": ""},
    )
    notes = ("A period that already exists for that class, day and number is skipped — edit it on the Timetable page.",)

    def prepare(self, rows):
        self._seen = set()
        self._existing = set(TimetableEntry.objects.values_list("school_class_id", "weekday", "period"))

    def validate(self, row_no, raw):
        r = self.new(row_no, raw)
        self.need(r, raw, "class", "day", "period", "start_time", "end_time")
        if r.errors:
            return r
        klass, err = self.L.find_class(raw["class"], raw.get("stream", ""), raw.get("session", ""))
        if err:
            r.errors.append(err)
        weekday = parse_weekday(raw["day"])
        if weekday is None:
            r.errors.append("Day must be Monday … Saturday (or 1–6).")
        if not (raw["period"].isdigit() and 1 <= int(raw["period"]) <= 20):
            r.errors.append("Period must be a number from 1 to 20.")
        start, end = parse_time(raw["start_time"]), parse_time(raw["end_time"])
        if not start or not end:
            r.errors.append("Start/end time not understood. Use e.g. 10:00 or 10:00 AM.")
        elif end <= start:
            r.errors.append("End time must be after the start time.")
        subject = None
        if raw.get("subject") and klass:
            subject = self.L.subjects.get((klass.id, raw["subject"].lower()))
            if not subject:
                r.errors.append(f"Subject “{raw['subject']}” was not found in {klass}.")
        if not raw.get("subject") and not raw.get("label"):
            r.errors.append("Give a Subject, or a Label such as Break.")
        teacher = None
        if raw.get("teacher"):
            teacher = self.L.teachers.get(raw["teacher"])
            if not teacher:
                r.errors.append(f"No active teacher with username “{raw['teacher']}”.")
        if len(raw.get("label", "")) > 60 or len(raw.get("room", "")) > 30:
            r.errors.append("Label (max 60) or room (max 30) is too long.")
        if r.errors:
            return r
        period = int(raw["period"])
        token = (klass.id, weekday, period)
        if token in self._seen:
            r.errors.append("This class + day + period appears twice in the file.")
            return r
        self._seen.add(token)
        if token in self._existing:
            r.action = "skip"
            r.warnings.append("That period already exists — will be skipped.")
        r.data.update(school_class=klass, weekday=weekday, period=period, start_time=start, end_time=end, subject=subject, label=_plain(raw.get("label", "")), teacher=teacher, room=_plain(raw.get("room", "")))
        r.display.update(**{"class": str(klass), "day": dict(TimetableEntry.WEEKDAYS)[weekday]})
        return r

    def commit(self, results):
        made = 0
        for r in results:
            if r.action == "skip":
                continue
            TimetableEntry.objects.create(**r.data)
            made += 1
        return {"created": made, "skipped": len(results) - made}


IMPORTERS = {cls.key: cls for cls in (
    StudentsImporter, TeachersImporter, ClassesImporter, SubjectsImporter, ResultsImporter,
    AttendanceImporter, TeacherAttendanceImporter, EventsImporter, ExamsImporter, TimetableImporter,
)}


def column_lookup(importer):
    """normalised header text -> column key (key, label and aliases all match)."""
    out = {}
    for c in importer.columns:
        for name in (c.key, c.label, *c.aliases):
            out.setdefault(norm(name), c.key)
    return out
