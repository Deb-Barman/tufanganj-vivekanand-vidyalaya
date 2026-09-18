from django.contrib import admin

from .models import AcademicSession, Attendance, Marksheet, Result, SchoolClass, StudentProfile, Subject, TeacherProfile

admin.site.register(AcademicSession)
admin.site.register(SchoolClass)
admin.site.register(Subject)
admin.site.register(TeacherProfile)
admin.site.register(StudentProfile)
admin.site.register(Attendance)
admin.site.register(Result)
admin.site.register(Marksheet)
