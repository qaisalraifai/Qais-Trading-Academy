"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const emptyForm = {
  course_id: "", name: "", instructor_id: "", start_date: "", end_date: "", seats_total: "",
};

export default function AdminBatchesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [liveBusyId, setLiveBusyId] = useState(null); // معرّف الدفعة اللي جاري تبديل حالة بثها هلأ

  const [attendanceBatch, setAttendanceBatch] = useState(null); // الدفعة اللي فاتحين شاشة حضورها
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceDetail, setAttendanceDetail] = useState(null); // { session, batch, students } لو فاتحين تفصيل بث معيّن

  const [announcementBatch, setAnnouncementBatch] = useState(null); // الدفعة اللي فاتحين شاشة إعلاناتها
  const [announcements, setAnnouncements] = useState([]);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", message: "", link: "" });
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");

  const [filesBatch, setFilesBatch] = useState(null); // الدفعة اللي فاتحين مكتبة ملفاتها
  const [batchFiles, setBatchFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [fileDeletingId, setFileDeletingId] = useState(null);

  const [certBatch, setCertBatch] = useState(null); // الدفعة اللي فاتحين شاشة شهاداتها
  const [certStudents, setCertStudents] = useState([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certBusyId, setCertBusyId] = useState(null); // معرّف الطالب اللي جاري إصدار/سحب شهادته هلأ
  const [certError, setCertError] = useState("");

  const [transferBatch, setTransferBatch] = useState(null); // الدفعة المصدر
  const [transferStudents, setTransferStudents] = useState([]);
  const [transferStudentId, setTransferStudentId] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);

  // -------------------- المرحلة 4: لوحة الإحصائيات + البحث والفلترة والترتيب --------------------
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | upcoming | ended | archived
  const [instructorFilter, setInstructorFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | name | seats | start_date

  useEffect(() => {
    checkAdmin();
    fetchCourses();
  }, []);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    const url = selectedCourseId ? `/api/admin/batches?course_id=${selectedCourseId}` : "/api/admin/batches";
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      setBatches(data.batches || []);
      setInstructors(data.instructors || []);
    } else {
      setError(data.error || "صار خطأ بجلب الدفعات");
    }
    setLoading(false);
  }, [selectedCourseId]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function fetchCourses() {
    const res = await fetch("/api/admin/courses");
    const data = await res.json();
    if (res.ok) setCourses(data.courses || []);
  }

  function courseLabel(courseId) {
    const c = courses.find((c) => c.id === courseId);
    return c ? `${c.icon} ${c.title}` : "—";
  }

  // -------------------- المرحلة 4: حساب حالة الدفعة (نشطة/قادمة/منتهية/مؤرشفة) --------------------
  const todayStr = new Date().toISOString().slice(0, 10);

  function getBatchStatus(batch) {
    if (batch.is_archived) return "archived";
    if (batch.start_date && batch.start_date > todayStr) return "upcoming";
    if (batch.end_date && batch.end_date < todayStr) return "ended";
    return "active";
  }

  const statusMeta = {
    active: { label: "نشطة", badge: "badgeActive" },
    upcoming: { label: "قادمة", badge: "badgeUpcoming" },
    ended: { label: "منتهية", badge: "badgeEnded" },
    archived: { label: "مؤرشفة", badge: "badgeArchived" },
  };

  // إحصائيات لوحة القمة — تُحسب على كل الدفعات (قبل فلاتر البحث المحلية) بحيث تعكس الصورة الكاملة
  const stats = useMemo(() => {
    let active = 0, upcoming = 0, ended = 0, archived = 0, totalStudents = 0, seatsRemaining = 0;
    batches.forEach((b) => {
      const st = getBatchStatus(b);
      if (st === "active") active++;
      else if (st === "upcoming") upcoming++;
      else if (st === "ended") ended++;
      else if (st === "archived") archived++;
      totalStudents += b.seats_taken || 0;
      if (b.seats_total != null) seatsRemaining += b.seats_remaining || 0;
    });
    return { total: batches.length, active, upcoming, ended, archived, totalStudents, seatsRemaining };
  }, [batches, todayStr]);

  // تطبيق البحث + فلتر الحالة + فلتر المدرب + الترتيب محليًا فوق الدفعات المجلوبة
  const filteredBatches = useMemo(() => {
    let list = [...batches];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((b) => {
        const nameMatch = (b.name || "").toLowerCase().includes(q);
        const courseMatch = courseLabel(b.course_id).toLowerCase().includes(q);
        return nameMatch || courseMatch;
      });
    }

    if (statusFilter !== "all") {
      list = list.filter((b) => getBatchStatus(b) === statusFilter);
    }

    if (instructorFilter) {
      list = list.filter((b) => b.instructor_id === instructorFilter);
    }

    switch (sortBy) {
      case "name":
        list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        break;
      case "seats":
        list.sort((a, b) => (b.seats_taken || 0) - (a.seats_taken || 0));
        break;
      case "start_date":
        list.sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));
        break;
      default: // newest — الترتيب الأصلي من الـ API محفوظ أصلًا (الأحدث إنشاءً أولًا)
        break;
    }

    return list;
  }, [batches, searchQuery, statusFilter, instructorFilter, sortBy, courses, todayStr]);
  // -----------------------------------------------------------------------------------------

  function openAddForm() {
    setEditingId(null);
    setForm({ ...emptyForm, course_id: selectedCourseId || "" });
    setError("");
    setShowForm(true);
  }

  function openEditForm(batch) {
    setEditingId(batch.id);
    setForm({
      course_id: batch.course_id,
      name: batch.name || "",
      instructor_id: batch.instructor_id || "",
      start_date: batch.start_date || "",
      end_date: batch.end_date || "",
      seats_total: batch.seats_total ?? "",
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = editingId ? `/api/admin/batches/${editingId}` : "/api/admin/batches";
    const method = editingId ? "PUT" : "POST";
    const payload = editingId
      ? { name: form.name, instructor_id: form.instructor_id || null, start_date: form.start_date || null, end_date: form.end_date || null, seats_total: form.seats_total || null }
      : { ...form, instructor_id: form.instructor_id || null, seats_total: form.seats_total || null };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "صار خطأ، حاولي مرة تانية");
      setSaving(false);
      return;
    }

    setSaving(false);
    closeForm();
    fetchBatches();
  }

  async function runAction(batchId, action, payload = {}) {
    const res = await fetch(`/api/admin/batches/${batchId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "صار خطأ بتنفيذ الإجراء");
      return;
    }
    fetchBatches();
  }

  async function handleDelete(batch) {
    if (!confirm(`متأكدة إنك بدك تحذفي دفعة "${batch.name}"؟ هالإجراء ما ممكن يترجع.`)) return;
    const res = await fetch(`/api/admin/batches/${batch.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) fetchBatches();
    else alert(data.error || "صار خطأ بالحذف");
  }

  // -------------------- المرحلة 7: بدء/إنهاء البث المباشر لدفعة محددة --------------------
  async function handleStartLive(batch) {
    setLiveBusyId(batch.id);
    const res = await fetch("/api/admin/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batch.id }),
    });
    const data = await res.json();
    setLiveBusyId(null);
    if (!res.ok) {
      alert(data.error || "صار خطأ ببدء البث");
      return;
    }
    fetchBatches();
  }

  async function handleEndLive(batch) {
    if (!confirm(`متأكدة إنك بدك تنهي بث دفعة "${batch.name}"؟`)) return;
    setLiveBusyId(batch.id);
    const res = await fetch(`/api/admin/live?batch_id=${batch.id}`, { method: "DELETE" });
    const data = await res.json();
    setLiveBusyId(null);
    if (!res.ok) {
      alert(data.error || "صار خطأ بإنهاء البث");
      return;
    }
    fetchBatches();
  }
  // -----------------------------------------------------------------------------------

  // -------------------- المرحلة 8: شاشة الحضور --------------------
  async function openAttendance(batch) {
    setAttendanceBatch(batch);
    setAttendanceDetail(null);
    setAttendanceLoading(true);
    const res = await fetch(`/api/admin/batches/${batch.id}/attendance`);
    const data = await res.json();
    setAttendanceSessions(res.ok ? data.sessions || [] : []);
    setAttendanceLoading(false);
  }

  function closeAttendance() {
    setAttendanceBatch(null);
    setAttendanceSessions([]);
    setAttendanceDetail(null);
  }

  async function openAttendanceDetail(sessionId) {
    setAttendanceLoading(true);
    const res = await fetch(`/api/admin/live-sessions/${sessionId}/attendance`);
    const data = await res.json();
    setAttendanceLoading(false);
    if (!res.ok) {
      alert(data.error || "صار خطأ بجلب تفاصيل الحضور");
      return;
    }
    setAttendanceDetail(data);
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("ar-JO", { dateStyle: "medium", timeStyle: "short" });
  }
  // -------------------------------------------------------------------

  // -------------------- المرحلة 9: الإعلانات --------------------
  async function openAnnouncements(batch) {
    setAnnouncementBatch(batch);
    setAnnouncementForm({ title: "", message: "", link: "" });
    setAnnouncementError("");
    setAnnouncementLoading(true);
    const res = await fetch(`/api/admin/batches/${batch.id}/announcements`);
    const data = await res.json();
    setAnnouncements(res.ok ? data.announcements || [] : []);
    setAnnouncementLoading(false);
  }

  function closeAnnouncements() {
    setAnnouncementBatch(null);
    setAnnouncements([]);
  }

  async function handleSendAnnouncement(e) {
    e.preventDefault();
    if (!announcementBatch) return;
    setAnnouncementSending(true);
    setAnnouncementError("");

    const res = await fetch(`/api/admin/batches/${announcementBatch.id}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(announcementForm),
    });
    const data = await res.json();
    setAnnouncementSending(false);

    if (!res.ok) {
      setAnnouncementError(data.error || "صار خطأ بإرسال الإعلان");
      return;
    }

    setAnnouncementForm({ title: "", message: "", link: "" });
    setAnnouncements((prev) => [data.announcement, ...prev]);
  }
  // -----------------------------------------------------------------

  // -------------------- المرحلة 10: مكتبة الملفات --------------------
  async function openFiles(batch) {
    setFilesBatch(batch);
    setFileError("");
    setFilesLoading(true);
    const res = await fetch(`/api/admin/batches/${batch.id}/files`);
    const data = await res.json();
    setBatchFiles(res.ok ? data.files || [] : []);
    setFilesLoading(false);
  }

  function closeFiles() {
    setFilesBatch(null);
    setBatchFiles([]);
  }

  async function handleUploadFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // يسمح ترفعي نفس الاسم مرة ثانية
    if (!file || !filesBatch) return;

    setFileError("");
    setFileUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/admin/batches/${filesBatch.id}/files`, { method: "POST", body: formData });
    const data = await res.json();
    setFileUploading(false);

    if (!res.ok) {
      setFileError(data.error || "صار خطأ برفع الملف");
      return;
    }
    setBatchFiles((prev) => [data.file, ...prev]);
  }

  async function handleDeleteFile(file) {
    if (!confirm(`متأكدة إنك بدك تحذفي "${file.file_name}"؟`)) return;
    setFileDeletingId(file.id);
    const res = await fetch(`/api/admin/batches/${filesBatch.id}/files/${file.id}`, { method: "DELETE" });
    const data = await res.json();
    setFileDeletingId(null);
    if (!res.ok) {
      alert(data.error || "صار خطأ بالحذف");
      return;
    }
    setBatchFiles((prev) => prev.filter((f) => f.id !== file.id));
  }

  function formatFileSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
  }
  // ---------------------------------------------------------------------

  // -------------------- المرحلة 13: الشهادات --------------------
  async function openCertificates(batch) {
    setCertBatch(batch);
    setCertError("");
    setCertLoading(true);
    const res = await fetch(`/api/admin/batches/${batch.id}/certificates`);
    const data = await res.json();
    setCertStudents(res.ok ? data.students || [] : []);
    setCertLoading(false);
  }

  function closeCertificates() {
    setCertBatch(null);
    setCertStudents([]);
  }

  async function handleIssueCertificate(student) {
    setCertError("");
    setCertBusyId(student.user_id);
    const res = await fetch(`/api/admin/batches/${certBatch.id}/certificates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: student.user_id }),
    });
    const data = await res.json();
    setCertBusyId(null);
    if (!res.ok) {
      setCertError(data.error || "صار خطأ بالإصدار");
      return;
    }
    setCertStudents((prev) =>
      prev.map((s) => (s.user_id === student.user_id ? { ...s, certificate: data.certificate } : s))
    );
  }

  async function handleRevokeCertificate(student) {
    if (!confirm(`متأكدة إنك بدك تسحبي شهادة "${student.username}"؟`)) return;
    setCertBusyId(student.user_id);
    const res = await fetch(`/api/admin/batches/${certBatch.id}/certificates/${student.certificate.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setCertBusyId(null);
    if (!res.ok) {
      alert(data.error || "صار خطأ بالسحب");
      return;
    }
    setCertStudents((prev) =>
      prev.map((s) => (s.user_id === student.user_id ? { ...s, certificate: null } : s))
    );
  }
  // ---------------------------------------------------------------------

  async function openTransfer(batch) {
    setTransferBatch(batch);
    setTransferStudentId("");
    setTransferTargetId("");
    setTransferError("");
    const res = await fetch(`/api/admin/batches/${batch.id}/students`);
    const data = await res.json();
    setTransferStudents(res.ok ? data.students || [] : []);
  }

  function closeTransfer() {
    setTransferBatch(null);
    setTransferStudents([]);
  }

  async function handleTransfer(e) {
    e.preventDefault();
    if (!transferStudentId || !transferTargetId) return;
    setTransferSaving(true);
    setTransferError("");

    const student = transferStudents.find((s) => s.user_id === transferStudentId);
    const res = await fetch("/api/admin/batches/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: transferStudentId, to_batch_id: transferTargetId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setTransferError(data.error || "صار خطأ بالنقل");
      setTransferSaving(false);
      return;
    }

    setTransferSaving(false);
    alert(`تم نقل ${student?.username || "الطالب"} بنجاح`);
    closeTransfer();
    fetchBatches();
  }

  const otherBatchesInCourse = transferBatch
    ? batches.filter((b) => b.course_id === transferBatch.course_id && b.id !== transferBatch.id && !b.is_archived)
    : [];

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <header style={s.header}>
        <div>
          <p style={s.headerSub}>لوحة التحكم</p>
          <h1 style={s.headerTitle}>إدارة الدفعات</h1>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/admin/lectures" style={s.backBtn}>← رجوع للمحاضرات</Link>
          <button onClick={openAddForm} style={s.addBtn}>+ إضافة دفعة</button>
        </div>
      </header>

      {/* -------------------- المرحلة 4: لوحة الإحصائيات -------------------- */}
      <div style={s.statsBar}>
        <button style={{ ...s.statCard, ...(statusFilter === "all" ? s.statCardActive : {}) }} onClick={() => setStatusFilter("all")}>
          <span style={s.statValue}>{stats.total}</span>
          <span style={s.statLabel}>كل الدفعات</span>
        </button>
        <button style={{ ...s.statCard, ...(statusFilter === "active" ? s.statCardActive : {}) }} onClick={() => setStatusFilter("active")}>
          <span style={{ ...s.statValue, color: "#02C076" }}>{stats.active}</span>
          <span style={s.statLabel}>نشطة</span>
        </button>
        <button style={{ ...s.statCard, ...(statusFilter === "upcoming" ? s.statCardActive : {}) }} onClick={() => setStatusFilter("upcoming")}>
          <span style={{ ...s.statValue, color: "#5b9bd5" }}>{stats.upcoming}</span>
          <span style={s.statLabel}>قادمة</span>
        </button>
        <button style={{ ...s.statCard, ...(statusFilter === "ended" ? s.statCardActive : {}) }} onClick={() => setStatusFilter("ended")}>
          <span style={{ ...s.statValue, color: "#999" }}>{stats.ended}</span>
          <span style={s.statLabel}>منتهية</span>
        </button>
        <button style={{ ...s.statCard, ...(statusFilter === "archived" ? s.statCardActive : {}) }} onClick={() => setStatusFilter("archived")}>
          <span style={{ ...s.statValue, color: "#777" }}>{stats.archived}</span>
          <span style={s.statLabel}>مؤرشفة</span>
        </button>
        <div style={{ ...s.statCard, cursor: "default" }}>
          <span style={{ ...s.statValue, color: gold }}>{stats.totalStudents}</span>
          <span style={s.statLabel}>إجمالي الطلاب</span>
        </div>
        <div style={{ ...s.statCard, cursor: "default" }}>
          <span style={{ ...s.statValue, color: gold }}>{stats.seatsRemaining}</span>
          <span style={s.statLabel}>المقاعد المتبقية</span>
        </div>
      </div>

      <div style={s.filterBar}>
        <div style={s.filterRow}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 220px" }}>
            <label style={s.label}>بحث</label>
            <input
              style={s.input}
              placeholder="اسم الدفعة أو الدورة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 200px" }}>
            <label style={s.label}>فلترة حسب الدورة</label>
            <select style={s.input} value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
              <option value="">كل الدورات</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 200px" }}>
            <label style={s.label}>فلترة حسب المدرب</label>
            <select style={s.input} value={instructorFilter} onChange={(e) => setInstructorFilter(e.target.value)}>
              <option value="">كل المدربين</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.username}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 200px" }}>
            <label style={s.label}>الحالة</label>
            <select style={s.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">كل الحالات</option>
              <option value="active">نشطة</option>
              <option value="upcoming">قادمة</option>
              <option value="ended">منتهية</option>
              <option value="archived">مؤرشفة</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 180px" }}>
            <label style={s.label}>ترتيب حسب</label>
            <select style={s.input} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">الأحدث إنشاءً</option>
              <option value="name">الاسم (أ-ي)</option>
              <option value="seats">عدد الطلاب</option>
              <option value="start_date">تاريخ البدء</option>
            </select>
          </div>
        </div>

        {(searchQuery || statusFilter !== "all" || instructorFilter || sortBy !== "newest") && (
          <button
            style={s.clearFiltersBtn}
            onClick={() => { setSearchQuery(""); setStatusFilter("all"); setInstructorFilter(""); setSortBy("newest"); }}
          >
            ✕ مسح كل الفلاتر
          </button>
        )}
      </div>

      {error && <p style={{ ...s.errorText, margin: "0 3rem" }}>{error}</p>}

      {/* -------------------- فورم إضافة/تعديل دفعة -------------------- */}
      {showForm && (
        <div style={s.overlay} onClick={closeForm}>
          <form style={s.formCard} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2 style={s.formTitle}>{editingId ? "تعديل دفعة" : "إضافة دفعة جديدة"}</h2>

            <label style={s.label}>الدورة</label>
            <select
              style={s.input}
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
              disabled={!!editingId}
              required
            >
              <option value="">اختاري الدورة</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
              ))}
            </select>
            {editingId && <p style={s.hint}>ما فيك تغيّري دورة الدفعة بعد إنشائها.</p>}

            <label style={s.label}>اسم الدفعة</label>
            <input
              style={s.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثلاً: دفعة يناير 2026 — مسائي"
              required
            />

            <label style={s.label}>المدرب (اختياري)</label>
            <select
              style={s.input}
              value={form.instructor_id}
              onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}
            >
              <option value="">بدون تحديد</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.username}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>تاريخ البداية</label>
                <input
                  type="date"
                  style={s.input}
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>تاريخ النهاية</label>
                <input
                  type="date"
                  style={s.input}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>

            <label style={s.label}>عدد المقاعد (اختياري)</label>
            <input
              type="number"
              min="1"
              style={s.input}
              value={form.seats_total}
              onChange={(e) => setForm({ ...form, seats_total: e.target.value })}
              placeholder="اتركيه فاضي = بدون حد أقصى"
            />

            {error && <p style={s.errorText}>{error}</p>}

            <div style={s.formActions}>
              <button type="button" onClick={closeForm} style={s.cancelBtn}>إلغاء</button>
              <button type="submit" disabled={saving} style={s.saveBtn}>
                {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة الدفعة"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- فورم نقل طالب -------------------- */}
      {transferBatch && (
        <div style={s.overlay} onClick={closeTransfer}>
          <form style={s.formCard} onClick={(e) => e.stopPropagation()} onSubmit={handleTransfer}>
            <h2 style={s.formTitle}>نقل طالب من "{transferBatch.name}"</h2>

            <label style={s.label}>الطالب</label>
            <select style={s.input} value={transferStudentId} onChange={(e) => setTransferStudentId(e.target.value)} required>
              <option value="">اختاري الطالب</option>
              {transferStudents.map((st) => (
                <option key={st.user_id} value={st.user_id}>{st.username} — {st.email}</option>
              ))}
            </select>
            {transferStudents.length === 0 && <p style={s.hint}>ما في طلاب مسجلين بهاي الدفعة حاليًا.</p>}

            <label style={s.label}>الدفعة الجديدة</label>
            <select style={s.input} value={transferTargetId} onChange={(e) => setTransferTargetId(e.target.value)} required>
              <option value="">اختاري الدفعة</option>
              {otherBatchesInCourse.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.seats_total != null ? `(${b.seats_remaining} مقعد متاح)` : ""}
                </option>
              ))}
            </select>
            {otherBatchesInCourse.length === 0 && <p style={s.hint}>ما في دفعات ثانية متاحة لنفس الدورة.</p>}

            <p style={s.hint}>تقدم الطالب محفوظ بالسجل ومش رح يتصفّر — بس رح تصير الدفعة الجديدة هي المرجع من هلأ وطالع.</p>

            {transferError && <p style={s.errorText}>{transferError}</p>}

            <div style={s.formActions}>
              <button type="button" onClick={closeTransfer} style={s.cancelBtn}>إلغاء</button>
              <button type="submit" disabled={transferSaving || !transferStudentId || !transferTargetId} style={s.saveBtn}>
                {transferSaving ? "جاري النقل..." : "نقل الطالب"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------- المرحلة 8: شاشة الحضور -------------------- */}
      {attendanceBatch && (
        <div style={s.overlay} onClick={closeAttendance}>
          <div style={{ ...s.formCard, maxWidth: "640px" }} onClick={(e) => e.stopPropagation()}>
            {!attendanceDetail ? (
              <>
                <h2 style={s.formTitle}>حضور دفعة "{attendanceBatch.name}"</h2>
                {attendanceLoading ? (
                  <p style={s.loading}>جاري التحميل...</p>
                ) : attendanceSessions.length === 0 ? (
                  <p style={s.hint}>ما في بثوث مسجّلة لهاي الدفعة لسا.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {attendanceSessions.map((sess) => (
                      <button
                        key={sess.id}
                        onClick={() => openAttendanceDetail(sess.id)}
                        style={s.sessionBtn}
                      >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.2rem" }}>
                          <span style={{ color: "#EAECEF", fontSize: "0.88rem", fontWeight: 600 }}>
                            {sess.title || "بث مباشر"} {sess.is_active && <span style={s.badgeLive}>🔴 نشط</span>}
                          </span>
                          <span style={s.mono}>{fmtDateTime(sess.started_at)}</span>
                        </div>
                        <span style={s.mono}>{sess.present_count} / {sess.total_students} حاضر</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={s.formActions}>
                  <button type="button" onClick={closeAttendance} style={s.cancelBtn}>إغلاق</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={s.formTitle}>{attendanceDetail.session.title || "بث مباشر"}</h2>
                <p style={s.hint}>{fmtDateTime(attendanceDetail.session.started_at)} — دفعة "{attendanceDetail.batch?.name || "—"}"</p>
                {attendanceLoading ? (
                  <p style={s.loading}>جاري التحميل...</p>
                ) : (
                  <div style={{ maxHeight: "50vh", overflowY: "auto", marginTop: "0.75rem" }}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          {["الطالب", "الحالة", "أول دخول", "آخر ظهور"].map((h, i) => (
                            <th key={i} style={s.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceDetail.students.map((st) => (
                          <tr key={st.user_id} style={s.tr}>
                            <td style={s.td}>
                              <span style={s.username}>{st.username}</span>
                              <br />
                              <span style={s.mono}>{st.email}</span>
                            </td>
                            <td style={s.td}>
                              {st.present ? (
                                <span style={s.badgeOpen}>حاضر</span>
                              ) : (
                                <span style={s.badgeClosed}>غايب</span>
                              )}
                            </td>
                            <td style={s.td}><span style={s.mono}>{fmtDateTime(st.first_joined_at)}</span></td>
                            <td style={s.td}><span style={s.mono}>{fmtDateTime(st.last_seen_at)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={s.formActions}>
                  <button type="button" onClick={() => setAttendanceDetail(null)} style={s.cancelBtn}>← رجوع لقائمة البثوث</button>
                  <button type="button" onClick={closeAttendance} style={s.saveBtn}>إغلاق</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* -------------------- المرحلة 9: الإعلانات -------------------- */}
      {announcementBatch && (
        <div style={s.overlay} onClick={closeAnnouncements}>
          <div style={{ ...s.formCard, maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.formTitle}>إعلانات دفعة "{announcementBatch.name}"</h2>
            <p style={s.hint}>بيوصل الإعلان بس لطلاب هاي الدفعة، عن طريق مركز الإشعارات عندهم.</p>

            <form onSubmit={handleSendAnnouncement} style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
              <label style={s.label}>عنوان الإعلان</label>
              <input
                style={s.input}
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                placeholder="مثلاً: تغيير موعد البث المباشر"
                required
              />

              <label style={s.label}>التفاصيل (اختياري)</label>
              <textarea
                style={{ ...s.input, minHeight: "80px", resize: "vertical", fontFamily: "inherit" }}
                value={announcementForm.message}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                placeholder="تفاصيل الإعلان..."
              />

              <label style={s.label}>رابط (اختياري)</label>
              <input
                style={s.input}
                value={announcementForm.link}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, link: e.target.value })}
                placeholder="مثلاً: /live-sessions"
              />

              {announcementError && <p style={s.errorText}>{announcementError}</p>}

              <div style={s.formActions}>
                <button type="button" onClick={closeAnnouncements} style={s.cancelBtn}>إغلاق</button>
                <button type="submit" disabled={announcementSending} style={s.saveBtn}>
                  {announcementSending ? "جاري الإرسال..." : "إرسال للدفعة"}
                </button>
              </div>
            </form>

            <hr style={{ border: "none", borderTop: "1px solid #222", margin: "1.25rem 0 0.75rem" }} />
            <p style={{ ...s.label, marginTop: 0 }}>إعلانات سابقة</p>

            {announcementLoading ? (
              <p style={s.loading}>جاري التحميل...</p>
            ) : announcements.length === 0 ? (
              <p style={s.hint}>ما في إعلانات مُرسلة لهاي الدفعة لسا.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "30vh", overflowY: "auto" }}>
                {announcements.map((a) => (
                  <div key={a.id} style={{ background: "#181A20", border: "1px solid #222", borderRadius: "6px", padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <span style={{ color: "#EAECEF", fontSize: "0.86rem", fontWeight: 700 }}>{a.title}</span>
                      <span style={s.mono}>{a.recipients_count} طالب</span>
                    </div>
                    {a.message && <p style={{ color: "#999", fontSize: "0.8rem", margin: "0.35rem 0 0" }}>{a.message}</p>}
                    <p style={{ ...s.mono, margin: "0.35rem 0 0" }}>{fmtDateTime(a.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- المرحلة 10: مكتبة الملفات -------------------- */}
      {filesBatch && (
        <div style={s.overlay} onClick={closeFiles}>
          <div style={{ ...s.formCard, maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.formTitle}>ملفات دفعة "{filesBatch.name}"</h2>
            <p style={s.hint}>الملفات هون بتظهر بس لطلاب هاي الدفعة بصفحة الدورة عندهم.</p>

            <label style={{ ...s.saveBtn, textAlign: "center", marginTop: "0.75rem", display: "block", cursor: "pointer" }}>
              {fileUploading ? "جاري الرفع..." : "+ رفع ملف جديد"}
              <input type="file" onChange={handleUploadFile} disabled={fileUploading} style={{ display: "none" }} />
            </label>
            <p style={s.hint}>الحد الأقصى 25 ميجابايت لكل ملف.</p>

            {fileError && <p style={s.errorText}>{fileError}</p>}

            <hr style={{ border: "none", borderTop: "1px solid #222", margin: "1rem 0 0.75rem" }} />

            {filesLoading ? (
              <p style={s.loading}>جاري التحميل...</p>
            ) : batchFiles.length === 0 ? (
              <p style={s.hint}>ما في ملفات مرفوعة لهاي الدفعة لسا.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "40vh", overflowY: "auto" }}>
                {batchFiles.map((f) => (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#181A20", border: "1px solid #222", borderRadius: "6px", padding: "0.65rem 0.9rem", gap: "0.5rem" }}>
                    <div style={{ minWidth: 0 }}>
                      <a href={f.download_url || "#"} target="_blank" rel="noopener noreferrer" style={{ color: "#5b9bd5", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}>
                        📄 {f.file_name}
                      </a>
                      <p style={{ ...s.mono, margin: "0.25rem 0 0" }}>{formatFileSize(f.file_size)} — {fmtDateTime(f.created_at)}</p>
                    </div>
                    <button onClick={() => handleDeleteFile(f)} disabled={fileDeletingId === f.id} style={s.btnDanger}>
                      {fileDeletingId === f.id ? "..." : "حذف"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={s.formActions}>
              <button type="button" onClick={closeFiles} style={s.cancelBtn}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- المرحلة 13: الشهادات -------------------- */}
      {certBatch && (
        <div style={s.overlay} onClick={closeCertificates}>
          <div style={{ ...s.formCard, maxWidth: "640px" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.formTitle}>شهادات دفعة "{certBatch.name}"</h2>
            <p style={s.hint}>
              الشهادة بتصدر تلقائيًا للطالب لما يخلّص 100% من محاضرات دفعته، أو تقدري تصدريها يدويًا بغض النظر عن نسبته.
            </p>

            {certError && <p style={s.errorText}>{certError}</p>}

            <hr style={{ border: "none", borderTop: "1px solid #222", margin: "0.75rem 0" }} />

            {certLoading ? (
              <p style={s.loading}>جاري التحميل...</p>
            ) : certStudents.length === 0 ? (
              <p style={s.hint}>ما في طلاب مسجّلين بهاي الدفعة لسا.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "50vh", overflowY: "auto" }}>
                {certStudents.map((st) => (
                  <div key={st.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#181A20", border: "1px solid #222", borderRadius: "6px", padding: "0.65rem 0.9rem", gap: "0.5rem" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#eee" }}>{st.username}</p>
                      <p style={{ ...s.mono, margin: "0.25rem 0 0" }}>
                        {st.progress.completed}/{st.progress.total} محاضرة ({st.progress.percent}%)
                        {st.certificate && (
                          <> — {st.certificate.is_automatic ? "صادرة تلقائيًا" : "صادرة يدويًا"} بتاريخ {fmtDateTime(st.certificate.issued_at)}</>
                        )}
                      </p>
                    </div>
                    {st.certificate ? (
                      <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                        <a href={`/certificate/${st.certificate.certificate_code}`} target="_blank" rel="noopener noreferrer" style={s.btnEdit}>
                          عرض
                        </a>
                        <button onClick={() => handleRevokeCertificate(st)} disabled={certBusyId === st.user_id} style={s.btnDanger}>
                          {certBusyId === st.user_id ? "..." : "سحب"}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleIssueCertificate(st)} disabled={certBusyId === st.user_id} style={s.saveBtn}>
                        {certBusyId === st.user_id ? "..." : "إصدار"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={s.formActions}>
              <button type="button" onClick={closeCertificates} style={s.cancelBtn}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- جدول الدفعات -------------------- */}
      <div style={s.cardsWrap}>
        {loading ? (
          <p style={s.loading}>جاري التحميل...</p>
        ) : batches.length === 0 ? (
          <p style={s.loading}>لا يوجد دفعات بعد.</p>
        ) : filteredBatches.length === 0 ? (
          <p style={s.loading}>ما في دفعات مطابقة لهاي الفلاتر.</p>
        ) : (
          <div style={s.cardsGrid}>
            {filteredBatches.map((batch) => {
              const instructor = instructors.find((i) => i.id === batch.instructor_id);
              const status = getBatchStatus(batch);
              const lifecycle = statusMeta[status];
              const fillPct = batch.seats_total
                ? Math.min(Math.round(((batch.seats_taken || 0) / batch.seats_total) * 100), 100)
                : null;
              const fillColor = batch.is_full ? "#F6465D" : fillPct != null && fillPct >= 80 ? "#d4a017" : "#02C076";

              return (
                <div key={batch.id} style={{ ...s.card, ...s[`cardAccent_${status}`] }}>
                  <div style={s.cardTop}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: 0 }}>
                      <span style={s.cardName}>{batch.name}</span>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        <span style={s[lifecycle.badge]}>{lifecycle.label}</span>
                        {batch.is_default && <span style={s.badgeDefault}>افتراضية</span>}
                        {batch.live_session && <span style={s.badgeLive}>🔴 مباشر الآن</span>}
                      </div>
                    </div>
                    <span style={batch.registration_status === "open" ? s.badgeOpen : s.badgeClosed}>
                      {batch.registration_status === "open" ? "التسجيل مفتوح" : "التسجيل مغلق"}
                    </span>
                  </div>

                  {/* الدورات ضمن الدفعة كـ Tags — حاليًا دورة وحدة لحد ما تنبني المرحلة 7 (دفعات متعددة الدورات) */}
                  <div style={s.courseTags}>
                    <span style={s.courseTag}>{courseLabel(batch.course_id)}</span>
                  </div>

                  <div style={s.cardMetaRow}>
                    <div style={s.cardMetaItem}>
                      <span style={s.statLabel}>المدرب</span>
                      <span style={s.mono}>{instructor?.username || "—"}</span>
                    </div>
                    <div style={s.cardMetaItem}>
                      <span style={s.statLabel}>الفترة</span>
                      <span style={s.mono}>{batch.start_date || "—"} → {batch.end_date || "—"}</span>
                    </div>
                  </div>

                  <div>
                    <div style={s.progressLabelRow}>
                      <span style={s.statLabel}>المقاعد</span>
                      <span style={s.mono}>
                        {batch.seats_taken}{batch.seats_total != null ? ` / ${batch.seats_total}` : " (بلا حد)"}
                        {batch.is_full && <span style={s.badgeFull}> ممتلئة</span>}
                      </span>
                    </div>
                    {fillPct != null && (
                      <div style={s.progressBarBg}>
                        <div style={{ ...s.progressBarFill, width: `${fillPct}%`, backgroundColor: fillColor }} />
                      </div>
                    )}
                  </div>

                  {!batch.is_archived && (
                    batch.live_session ? (
                      <button
                        onClick={() => handleEndLive(batch)}
                        disabled={liveBusyId === batch.id}
                        style={{ ...s.btnDanger, width: "100%", padding: "0.55rem" }}
                      >
                        {liveBusyId === batch.id ? "جاري الإنهاء..." : "⏹ إنهاء البث"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartLive(batch)}
                        disabled={liveBusyId === batch.id}
                        style={{ ...s.btnLive, width: "100%", padding: "0.55rem" }}
                      >
                        {liveBusyId === batch.id ? "جاري البدء..." : "🔴 ابدأ بث"}
                      </button>
                    )
                  )}

                  <div style={s.cardActions}>
                    <button onClick={() => openEditForm(batch)} style={s.btnEdit}>تعديل</button>
                    <button onClick={() => openAttendance(batch)} style={s.btnEdit}>الحضور</button>
                    <button onClick={() => openAnnouncements(batch)} style={s.btnEdit}>إعلانات</button>
                    <button onClick={() => openFiles(batch)} style={s.btnEdit}>الملفات</button>
                    <button onClick={() => openCertificates(batch)} style={s.btnEdit}>الشهادات</button>
                    <button onClick={() => openTransfer(batch)} style={s.btnEdit}>نقل طالب</button>
                    <button onClick={() => runAction(batch.id, "duplicate")} style={s.btnEdit}>نسخ</button>
                    {!batch.is_archived && (
                      <button
                        onClick={() => runAction(batch.id, batch.registration_status === "open" ? "close_registration" : "open_registration")}
                        style={s.btnEdit}
                      >
                        {batch.registration_status === "open" ? "إغلاق التسجيل" : "فتح التسجيل"}
                      </button>
                    )}
                    {!batch.is_default && (
                      <button
                        onClick={() => runAction(batch.id, batch.is_archived ? "unarchive" : "archive")}
                        style={s.btnEdit}
                      >
                        {batch.is_archived ? "فك الأرشفة" : "أرشفة"}
                      </button>
                    )}
                    {!batch.is_default && (
                      <button onClick={() => handleDelete(batch)} style={s.btnDanger}>حذف</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const gold = "#D4AF37";
const ink = "#0B0E11";
const s = {
  page: { backgroundColor: ink, color: "#EAECEF", direction: "rtl", fontFamily: "'Inter', sans-serif", minHeight: "100vh", padding: "0 0 4rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2rem 3rem", borderBottom: "1px solid #181A20" },
  headerSub: { fontFamily: "'JetBrains Mono', monospace", color: gold, fontSize: "0.75rem", letterSpacing: "2px", marginBottom: "0.25rem" },
  headerTitle: { fontSize: "1.4rem", fontWeight: 800 },
  backBtn: { background: "none", border: "1px solid #222", color: "#999", padding: "0.6rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", textDecoration: "none", display: "flex", alignItems: "center" },
  addBtn: { backgroundColor: gold, color: "#000", border: "none", padding: "0.6rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 },
  statsBar: { display: "flex", flexWrap: "wrap", gap: "0.9rem", margin: "1.75rem 3rem 0" },
  statCard: { display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "flex-start", backgroundColor: "#0d0d0d", border: "1px solid #181A20", borderRadius: "8px", padding: "1rem 1.3rem", minWidth: "130px", cursor: "pointer", fontFamily: "inherit", textAlign: "right" },
  statCardActive: { borderColor: gold },
  statValue: { fontSize: "1.5rem", fontWeight: 800, color: "#EAECEF", fontFamily: "'JetBrains Mono', monospace" },
  statLabel: { fontSize: "0.78rem", color: "#666" },
  filterBar: { display: "flex", flexDirection: "column", gap: "0.75rem", margin: "1.5rem 3rem 0" },
  filterRow: { display: "flex", flexWrap: "wrap", gap: "1rem" },
  clearFiltersBtn: { alignSelf: "flex-start", background: "none", border: "1px solid #222", color: "#999", padding: "0.45rem 0.9rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.78rem" },
  badgeActive: { marginRight: "0.5rem", fontSize: "0.68rem", backgroundColor: "#0a2a1e", color: "#02C076", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeUpcoming: { marginRight: "0.5rem", fontSize: "0.68rem", backgroundColor: "#1a2a3a", color: "#5b9bd5", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeEnded: { marginRight: "0.5rem", fontSize: "0.68rem", backgroundColor: "#181A20", color: "#999", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  cardsWrap: { margin: "1.5rem 3rem 2rem" },
  cardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.1rem" },
  card: { display: "flex", flexDirection: "column", gap: "0.9rem", backgroundColor: "#0d0d0d", border: "1px solid #181A20", borderRight: "3px solid #333", borderRadius: "8px", padding: "1.3rem", transition: "border-color 0.15s ease" },
  cardAccent_active: { borderRightColor: "#02C076" },
  cardAccent_upcoming: { borderRightColor: "#5b9bd5" },
  cardAccent_ended: { borderRightColor: "#555" },
  cardAccent_archived: { borderRightColor: "#333", opacity: 0.7 },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" },
  cardName: { fontSize: "1.05rem", fontWeight: 700, color: "#EAECEF" },
  courseTags: { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  courseTag: { fontSize: "0.75rem", color: "#c9a227", backgroundColor: "#1a160a", border: "1px solid #33290a", padding: "0.2rem 0.65rem", borderRadius: "999px" },
  cardMetaRow: { display: "flex", gap: "1.5rem", flexWrap: "wrap" },
  cardMetaItem: { display: "flex", flexDirection: "column", gap: "0.25rem" },
  progressLabelRow: { display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" },
  progressBarBg: { width: "100%", height: "6px", backgroundColor: "#181A20", borderRadius: "999px", overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: "999px", transition: "width 0.2s ease" },
  cardActions: { display: "flex", gap: "0.4rem", flexWrap: "wrap", paddingTop: "0.6rem", borderTop: "1px solid #181A20" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { backgroundColor: "#181A20", padding: "1rem 1.25rem", textAlign: "right", fontSize: "0.78rem", color: "#444", fontWeight: 500, borderBottom: "1px solid #111", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #0d0d0d" },
  td: { padding: "1rem 1.25rem", fontSize: "0.88rem", verticalAlign: "middle" },
  username: { color: "#EAECEF", fontWeight: 500 },
  mono: { fontFamily: "'JetBrains Mono', monospace", color: "#555", fontSize: "0.82rem" },
  btnEdit: { backgroundColor: "#1a2a3a", color: "#5b9bd5", border: "1px solid #2a3a5a", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.78rem" },
  btnDanger: { backgroundColor: "#2a1a1a", color: "#ef5350", border: "1px solid #4a2a2a", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.78rem" },
  loading: { textAlign: "center", padding: "3rem", color: "#444" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" },
  formCard: { backgroundColor: "#0d0d0d", border: `1px solid ${gold}44`, borderRadius: "8px", padding: "2rem", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "90vh", overflowY: "auto" },
  formTitle: { fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem" },
  label: { fontSize: "0.82rem", color: "#999", marginTop: "0.75rem" },
  input: { backgroundColor: "#181A20", border: "1px solid #222", color: "#EAECEF", padding: "0.7rem 0.9rem", borderRadius: "4px", fontSize: "0.9rem", outline: "none", fontFamily: "inherit" },
  hint: { fontSize: "0.75rem", color: "#555", marginTop: "0.15rem" },
  errorText: { color: "#ef5350", fontSize: "0.85rem", marginTop: "0.5rem" },
  formActions: { display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" },
  cancelBtn: { background: "none", border: "1px solid #222", color: "#999", padding: "0.6rem 1.4rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" },
  saveBtn: { backgroundColor: gold, color: "#000", border: "none", padding: "0.6rem 1.4rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 },
  badgeDefault: { marginRight: "0.5rem", fontSize: "0.68rem", backgroundColor: "#1a2a3a", color: "#5b9bd5", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeArchived: { marginRight: "0.5rem", fontSize: "0.68rem", backgroundColor: "#2a1a1a", color: "#999", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeFull: { color: "#ef5350", fontSize: "0.75rem" },
  badgeLive: { fontSize: "0.72rem", color: "#F6465D", backgroundColor: "#2a1418", padding: "0.25rem 0.6rem", borderRadius: "3px", fontWeight: 700 },
  btnLive: { backgroundColor: "#F6465D", color: "#fff", border: "none", padding: "0.45rem 0.85rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" },
  sessionBtn: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#181A20", border: "1px solid #222", borderRadius: "6px", padding: "0.75rem 1rem", cursor: "pointer", width: "100%", textAlign: "right", fontFamily: "inherit" },
  badgeOpen: { fontSize: "0.75rem", color: "#02C076", backgroundColor: "#0a2a1e", padding: "0.25rem 0.6rem", borderRadius: "3px" },
  badgeClosed: { fontSize: "0.75rem", color: "#999", backgroundColor: "#181A20", padding: "0.25rem 0.6rem", borderRadius: "3px" },
};
