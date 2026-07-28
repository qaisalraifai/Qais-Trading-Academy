"use client";

// المرحلة 6أ من "خطة إعادة تصميم الدفعات": صفحة تحكم مستقلة لكل دفعة، بتبويبات،
// بدل النوافذ المنبثقة (Modals) اللي كانت مبعثرة بصفحة /admin/batches.
//
// هاي المرحلة بس نقل واجهة — صفر تغيير Backend. التبويبات المنقولة كاملة:
// نظرة عامة، الطلاب (+ نقل بين دفعات)، البث والحضور (مدموجين لأنهم مرتبطين
// فعليًا بالكود)، الملفات، الإعلانات، الشهادات، الإعدادات.
//
// التبويبات: المحاضرات (6د)، الاختبارات (6هـ)، الواجبات (6ب)، التقويم (6ج) —
// كل وحدة رح تُبنى بمرحلتها الخاصة حسب خطة "تصميم-معماري-صفحة-الدفعة"، فهي
// هون بس عنصر نائب (Placeholder) واضح إنها "قريبًا".

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";

const TABS = [
  { id: "overview", label: "نظرة عامة", ready: true },
  { id: "students", label: "الطلاب", ready: true },
  { id: "live", label: "البث والحضور", ready: true },
  { id: "lectures", label: "المحاضرات", ready: false, note: "قريبًا — المرحلة 6د" },
  { id: "quizzes", label: "الاختبارات", ready: false, note: "قريبًا — المرحلة 6هـ" },
  { id: "assignments", label: "الواجبات", ready: true },
  { id: "files", label: "الملفات", ready: true },
  { id: "announcements", label: "الإعلانات", ready: true },
  { id: "certificates", label: "الشهادات", ready: true },
  { id: "calendar", label: "التقويم", ready: false, note: "قريبًا — المرحلة 6ج" },
  { id: "settings", label: "الإعدادات", ready: true },
];

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-JO", { dateStyle: "medium", timeStyle: "short" });
}

function formatFileSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

export default function BatchDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const batchId = params.id;

  const [tab, setTab] = useState("overview");
  const [batch, setBatch] = useState(null);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveBusy, setLiveBusy] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  const fetchBatch = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/batches/${batchId}`);
    const data = await res.json();
    if (res.ok) {
      setBatch(data.batch);
      setInstructors(data.instructors || []);
      setError("");
    } else {
      setError(data.error || "صار خطأ بجلب الدفعة");
    }
    setLoading(false);
  }, [batchId]);

  useEffect(() => {
    if (batchId) fetchBatch();
  }, [batchId, fetchBatch]);

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || profile.role !== "admin") router.push("/dashboard");
  }

  async function runAction(action, payload = {}) {
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
    fetchBatch();
  }

  async function handleStartLive() {
    setLiveBusy(true);
    const res = await fetch("/api/admin/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId }),
    });
    const data = await res.json();
    setLiveBusy(false);
    if (!res.ok) { alert(data.error || "صار خطأ ببدء البث"); return; }
    fetchBatch();
  }

  async function handleEndLive() {
    if (!confirm(`متأكدة إنك بدك تنهي بث دفعة "${batch.name}"؟`)) return;
    setLiveBusy(true);
    const res = await fetch(`/api/admin/live?batch_id=${batchId}`, { method: "DELETE" });
    const data = await res.json();
    setLiveBusy(false);
    if (!res.ok) { alert(data.error || "صار خطأ بإنهاء البث"); return; }
    fetchBatch();
  }

  if (loading) {
    return (
      <div style={s.page}>
        <p style={s.loading}>جاري التحميل...</p>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div style={s.page}>
        <p style={{ ...s.errorText, padding: "3rem" }}>{error || "الدفعة غير موجودة"}</p>
        <Link href="/admin/batches" style={s.backBtn}>← رجوع لكل الدفعات</Link>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const status = batch.is_archived
    ? "archived"
    : batch.start_date && batch.start_date > todayStr
    ? "upcoming"
    : batch.end_date && batch.end_date < todayStr
    ? "ended"
    : "active";
  const statusMeta = {
    active: { label: "نشطة", badge: s.badgeActive },
    upcoming: { label: "قادمة", badge: s.badgeUpcoming },
    ended: { label: "منتهية", badge: s.badgeEnded },
    archived: { label: "مؤرشفة", badge: s.badgeArchived },
  }[status];

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <header style={s.header}>
        <div>
          <Link href="/admin/batches" style={s.headerBack}>← كل الدفعات</Link>
          <h1 style={s.headerTitle}>{batch.name}</h1>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
            <span style={statusMeta.badge}>{statusMeta.label}</span>
            {batch.is_default && <span style={s.badgeDefault}>افتراضية</span>}
            {batch.live_session && <span style={s.badgeLive}>🔴 مباشر الآن</span>}
            <span style={batch.registration_status === "open" ? s.badgeOpen : s.badgeClosed}>
              {batch.registration_status === "open" ? "التسجيل مفتوح" : "التسجيل مغلق"}
            </span>
          </div>
        </div>
        {!batch.is_archived && (
          batch.live_session ? (
            <button onClick={handleEndLive} disabled={liveBusy} style={s.btnDanger}>
              {liveBusy ? "جاري الإنهاء..." : "⏹ إنهاء البث"}
            </button>
          ) : (
            <button onClick={handleStartLive} disabled={liveBusy} style={s.btnLive}>
              {liveBusy ? "جاري البدء..." : "🔴 ابدأ بث"}
            </button>
          )
        )}
      </header>

      <nav style={s.tabsBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.ready ? "" : t.note}
            style={{ ...s.tabBtn, ...(tab === t.id ? s.tabBtnActive : {}), ...(t.ready ? {} : s.tabBtnDisabled) }}
          >
            {t.label}
            {!t.ready && <span style={s.tabSoon}>قريبًا</span>}
          </button>
        ))}
      </nav>

      <div style={s.tabBody}>
        {tab === "overview" && <OverviewTab batch={batch} instructors={instructors} />}
        {tab === "students" && <StudentsTab batchId={batchId} batch={batch} onTransferred={fetchBatch} />}
        {tab === "live" && <LiveAttendanceTab batchId={batchId} />}
        {tab === "lectures" && <ComingSoon note={TABS.find((t) => t.id === "lectures").note} />}
        {tab === "quizzes" && <ComingSoon note={TABS.find((t) => t.id === "quizzes").note} />}
        {tab === "assignments" && <AssignmentsTab batchId={batchId} />}
        {tab === "files" && <FilesTab batchId={batchId} />}
        {tab === "announcements" && <AnnouncementsTab batchId={batchId} />}
        {tab === "certificates" && <CertificatesTab batchId={batchId} />}
        {tab === "calendar" && <ComingSoon note={TABS.find((t) => t.id === "calendar").note} />}
        {tab === "settings" && (
          <SettingsTab batch={batch} instructors={instructors} onSaved={fetchBatch} onAction={runAction} router={router} />
        )}
      </div>
    </div>
  );
}

function ComingSoon({ note }) {
  return <p style={s.hint}>{note}</p>;
}

/* -------------------- نظرة عامة -------------------- */
function OverviewTab({ batch, instructors }) {
  const instructor = instructors.find((i) => i.id === batch.instructor_id);
  const fillPct = batch.seats_total
    ? Math.min(Math.round(((batch.seats_taken || 0) / batch.seats_total) * 100), 100)
    : null;

  return (
    <div style={s.overviewGrid}>
      <div style={s.overviewCard}>
        <span style={s.statLabel}>الدورة</span>
        <span style={s.overviewValue}>{batch.course ? `${batch.course.icon || ""} ${batch.course.title}` : "—"}</span>
      </div>
      <div style={s.overviewCard}>
        <span style={s.statLabel}>المدرب</span>
        <span style={s.overviewValue}>{instructor?.username || batch.instructor?.username || "—"}</span>
      </div>
      <div style={s.overviewCard}>
        <span style={s.statLabel}>الفترة</span>
        <span style={s.overviewValue}>{batch.start_date || "—"} → {batch.end_date || "—"}</span>
      </div>
      <div style={s.overviewCard}>
        <span style={s.statLabel}>المقاعد</span>
        <span style={s.overviewValue}>
          {batch.seats_taken}{batch.seats_total != null ? ` / ${batch.seats_total}` : " (بلا حد)"}
        </span>
        {fillPct != null && (
          <div style={s.progressBarBg}>
            <div style={{ ...s.progressBarFill, width: `${fillPct}%`, backgroundColor: batch.is_full ? "#F6465D" : "#02C076" }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- الطلاب + نقل -------------------- */
function StudentsTab({ batchId, batch, onTransferred }) {
  const [students, setStudents] = useState([]);
  const [otherBatches, setOtherBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transferStudentId, setTransferStudentId] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferError, setTransferError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [res, allRes] = await Promise.all([
      fetch(`/api/admin/batches/${batchId}/students`),
      fetch(`/api/admin/batches?course_id=${batch.course_id}`),
    ]);
    const data = await res.json();
    const allData = await allRes.json();
    setStudents(res.ok ? data.students || [] : []);
    setOtherBatches(allRes.ok ? (allData.batches || []).filter((b) => b.id !== batchId && !b.is_archived) : []);
    setLoading(false);
  }, [batchId, batch.course_id]);

  useEffect(() => { load(); }, [load]);

  async function handleTransfer(e) {
    e.preventDefault();
    if (!transferStudentId || !transferTargetId) return;
    setSaving(true);
    setTransferError("");
    const res = await fetch("/api/admin/batches/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: transferStudentId, to_batch_id: transferTargetId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setTransferError(data.error || "صار خطأ بالنقل"); return; }
    setTransferStudentId("");
    setTransferTargetId("");
    load();
    onTransferred?.();
  }

  return (
    <div>
      <div style={s.card}>
        <h3 style={s.cardTitle}>نقل طالب لدفعة ثانية</h3>
        <form onSubmit={handleTransfer} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px" }}>
            <label style={s.label}>الطالب</label>
            <select style={s.input} value={transferStudentId} onChange={(e) => setTransferStudentId(e.target.value)} required>
              <option value="">اختاري الطالب</option>
              {students.map((st) => (
                <option key={st.user_id} value={st.user_id}>{st.username} — {st.email}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label style={s.label}>الدفعة الجديدة</label>
            <select style={s.input} value={transferTargetId} onChange={(e) => setTransferTargetId(e.target.value)} required>
              <option value="">اختاري الدفعة</option>
              {otherBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} {b.seats_total != null ? `(${b.seats_remaining} مقعد متاح)` : ""}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={saving || !transferStudentId || !transferTargetId} style={s.saveBtn}>
            {saving ? "جاري النقل..." : "نقل"}
          </button>
        </form>
        {transferError && <p style={s.errorText}>{transferError}</p>}
        <p style={s.hint}>تقدم الطالب محفوظ ومش رح يتصفّر — بس رح تصير الدفعة الجديدة هي المرجع من هلأ وطالع.</p>
      </div>

      <div style={{ ...s.card, marginTop: "1rem" }}>
        <h3 style={s.cardTitle}>الطلاب المسجّلين ({students.length})</h3>
        {loading ? (
          <p style={s.loading}>جاري التحميل...</p>
        ) : students.length === 0 ? (
          <p style={s.hint}>ما في طلاب مسجلين بهاي الدفعة لسا.</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>{["الطالب", "البريد", "تاريخ التسجيل"].map((h, i) => <th key={i} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {students.map((st) => (
                <tr key={st.user_id} style={s.tr}>
                  <td style={s.td}><span style={s.username}>{st.username}</span></td>
                  <td style={s.td}><span style={s.mono}>{st.email}</span></td>
                  <td style={s.td}><span style={s.mono}>{fmtDateTime(st.enrolled_at)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* -------------------- البث والحضور (مدموجين) -------------------- */
function LiveAttendanceTab({ batchId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/batches/${batchId}/attendance`);
    const data = await res.json();
    setSessions(res.ok ? data.sessions || [] : []);
    setLoading(false);
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(sessionId) {
    setLoading(true);
    const res = await fetch(`/api/admin/live-sessions/${sessionId}/attendance`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { alert(data.error || "صار خطأ بجلب تفاصيل الحضور"); return; }
    setDetail(data);
  }

  if (detail) {
    return (
      <div style={s.card}>
        <button onClick={() => setDetail(null)} style={s.cancelBtn}>← رجوع لقائمة البثوث</button>
        <h3 style={{ ...s.cardTitle, marginTop: "0.75rem" }}>{detail.session.title || "بث مباشر"}</h3>
        <p style={s.hint}>{fmtDateTime(detail.session.started_at)}</p>
        {loading ? (
          <p style={s.loading}>جاري التحميل...</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>{["الطالب", "الحالة", "أول دخول", "آخر ظهور"].map((h, i) => <th key={i} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {detail.students.map((st) => (
                <tr key={st.user_id} style={s.tr}>
                  <td style={s.td}><span style={s.username}>{st.username}</span><br /><span style={s.mono}>{st.email}</span></td>
                  <td style={s.td}>{st.present ? <span style={s.badgeOpen}>حاضر</span> : <span style={s.badgeClosed}>غايب</span>}</td>
                  <td style={s.td}><span style={s.mono}>{fmtDateTime(st.first_joined_at)}</span></td>
                  <td style={s.td}><span style={s.mono}>{fmtDateTime(st.last_seen_at)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <div style={s.card}>
      <h3 style={s.cardTitle}>سجل البثوث والحضور</h3>
      {loading ? (
        <p style={s.loading}>جاري التحميل...</p>
      ) : sessions.length === 0 ? (
        <p style={s.hint}>ما في بثوث مسجّلة لهاي الدفعة لسا.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {sessions.map((sess) => (
            <button key={sess.id} onClick={() => openDetail(sess.id)} style={s.sessionBtn}>
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
    </div>
  );
}

/* -------------------- الواجبات (المرحلة 6ب) -------------------- */
const emptyAssignmentForm = { title: "", description: "", due_date: "" };

function AssignmentsTab({ batchId }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyAssignmentForm);
  const [saving, setSaving] = useState(false);
  const [openAssignment, setOpenAssignment] = useState(null); // الواجب اللي فاتحين تسليماته

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/batches/${batchId}/assignments`);
    const data = await res.json();
    setAssignments(res.ok ? data.assignments || [] : []);
    if (!res.ok) setError(data.error || "صار خطأ بجلب الواجبات");
    setLoading(false);
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  function openAddForm() {
    setEditingId(null);
    setForm(emptyAssignmentForm);
    setError("");
    setShowForm(true);
  }

  function openEditForm(a) {
    setEditingId(a.id);
    setForm({ title: a.title || "", description: a.description || "", due_date: a.due_date || "" });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const url = editingId
      ? `/api/admin/batches/${batchId}/assignments/${editingId}`
      : `/api/admin/batches/${batchId}/assignments`;
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "صار خطأ بالحفظ"); return; }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyAssignmentForm);
    load();
  }

  async function handleDelete(a) {
    if (!confirm(`متأكدة إنك بدك تحذفي واجب "${a.title}"؟ رح تنحذف كل التسليمات معه.`)) return;
    const res = await fetch(`/api/admin/batches/${batchId}/assignments/${a.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) load();
    else alert(data.error || "صار خطأ بالحذف");
  }

  if (openAssignment) {
    return (
      <SubmissionsPanel
        assignment={openAssignment}
        onClose={() => { setOpenAssignment(null); load(); }}
      />
    );
  }

  return (
    <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ ...s.cardTitle, margin: 0 }}>واجبات الدفعة</h3>
        <button onClick={openAddForm} style={s.saveBtn}>+ واجب جديد</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxWidth: "480px", marginBottom: "1rem", background: "#181A20", border: "1px solid #222", borderRadius: "6px", padding: "1rem" }}>
          <label style={s.label}>عنوان الواجب</label>
          <input style={s.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />

          <label style={s.label}>الوصف (اختياري)</label>
          <textarea style={{ ...s.input, minHeight: "70px", resize: "vertical", fontFamily: "inherit" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <label style={s.label}>موعد التسليم (اختياري)</label>
          <input type="date" style={s.input} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />

          {error && <p style={s.errorText}>{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="button" onClick={() => setShowForm(false)} style={s.cancelBtn}>إلغاء</button>
            <button type="submit" disabled={saving} style={s.saveBtn}>{saving ? "جاري الحفظ..." : "حفظ"}</button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={s.loading}>جاري التحميل...</p>
      ) : assignments.length === 0 ? (
        <p style={s.hint}>ما في واجبات لهاي الدفعة لسا.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {assignments.map((a) => (
            <div key={a.id} style={s.rowItem}>
              <div style={{ minWidth: 0, cursor: "pointer" }} onClick={() => setOpenAssignment(a)}>
                <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "#EAECEF" }}>{a.title}</p>
                {a.description && <p style={{ color: "#999", fontSize: "0.8rem", margin: "0.3rem 0 0" }}>{a.description}</p>}
                <p style={{ ...s.mono, margin: "0.35rem 0 0" }}>
                  {a.due_date ? `موعد التسليم: ${a.due_date}` : "بدون موعد محدد"} — {a.submitted_count} تسليم ({a.graded_count} مقيّم)
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                <button onClick={() => setOpenAssignment(a)} style={s.btnEdit}>التسليمات</button>
                <button onClick={() => openEditForm(a)} style={s.btnEdit}>تعديل</button>
                <button onClick={() => handleDelete(a)} style={s.btnDanger}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionsPanel({ assignment, onClose }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState(null);
  const [gradeForm, setGradeForm] = useState({ grade: "", feedback: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/assignments/${assignment.id}/submissions`);
    const data = await res.json();
    setSubmissions(res.ok ? data.submissions || [] : []);
    setLoading(false);
  }, [assignment.id]);

  useEffect(() => { load(); }, [load]);

  function startGrading(sub) {
    setGradingId(sub.id);
    setGradeForm({ grade: sub.grade || "", feedback: sub.feedback || "" });
  }

  async function handleGrade(e, sub) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/admin/assignments/${assignment.id}/submissions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gradeForm),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error || "صار خطأ بالتقييم"); return; }
    setGradingId(null);
    load();
  }

  return (
    <div style={s.card}>
      <button onClick={onClose} style={s.cancelBtn}>← رجوع لكل الواجبات</button>
      <h3 style={{ ...s.cardTitle, marginTop: "0.75rem" }}>تسليمات "{assignment.title}"</h3>
      {loading ? (
        <p style={s.loading}>جاري التحميل...</p>
      ) : submissions.length === 0 ? (
        <p style={s.hint}>ما في تسليمات لهاد الواجب لسا.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {submissions.map((sub) => (
            <div key={sub.id} style={{ background: "#181A20", border: "1px solid #222", borderRadius: "6px", padding: "0.85rem 1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <span style={s.username}>{sub.username}</span> <span style={s.mono}>— {sub.email}</span>
                  <p style={{ ...s.mono, margin: "0.3rem 0 0" }}>سلّم بتاريخ {fmtDateTime(sub.submitted_at)}</p>
                  {sub.note && <p style={{ color: "#ccc", fontSize: "0.82rem", margin: "0.4rem 0 0" }}>{sub.note}</p>}
                  {sub.file_path && (
                    <a href={sub.download_url || "#"} target="_blank" rel="noopener noreferrer" style={{ ...s.fileLink, display: "inline-block", marginTop: "0.4rem" }}>
                      📄 {sub.file_name || "الملف المرفوع"}
                    </a>
                  )}
                </div>
                <div style={{ textAlign: "left", flexShrink: 0 }}>
                  {sub.grade ? (
                    <span style={s.badgeOpen}>الدرجة: {sub.grade}</span>
                  ) : (
                    <span style={s.badgeClosed}>لسا ما انقيّم</span>
                  )}
                </div>
              </div>

              {sub.feedback && gradingId !== sub.id && (
                <p style={{ color: "#999", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>ملاحظتك: {sub.feedback}</p>
              )}

              {gradingId === sub.id ? (
                <form onSubmit={(e) => handleGrade(e, sub)} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end", marginTop: "0.6rem" }}>
                  <div style={{ flex: "1 1 140px" }}>
                    <label style={s.label}>الدرجة</label>
                    <input style={s.input} value={gradeForm.grade} onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} placeholder="مثلاً: 9/10" required />
                  </div>
                  <div style={{ flex: "2 1 220px" }}>
                    <label style={s.label}>ملاحظة (اختياري)</label>
                    <input style={s.input} value={gradeForm.feedback} onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })} />
                  </div>
                  <button type="button" onClick={() => setGradingId(null)} style={s.cancelBtn}>إلغاء</button>
                  <button type="submit" disabled={saving} style={s.saveBtn}>{saving ? "جاري الحفظ..." : "حفظ التقييم"}</button>
                </form>
              ) : (
                <button onClick={() => startGrading(sub)} style={{ ...s.btnEdit, marginTop: "0.6rem" }}>
                  {sub.grade ? "تعديل التقييم" : "تقييم"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- الملفات -------------------- */
function FilesTab({ batchId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/batches/${batchId}/files`);
    const data = await res.json();
    setFiles(res.ok ? data.files || [] : []);
    setLoading(false);
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/batches/${batchId}/files`, { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { setError(data.error || "صار خطأ برفع الملف"); return; }
    setFiles((prev) => [data.file, ...prev]);
  }

  async function handleDelete(file) {
    if (!confirm(`متأكدة إنك بدك تحذفي "${file.file_name}"؟`)) return;
    setDeletingId(file.id);
    const res = await fetch(`/api/admin/batches/${batchId}/files/${file.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingId(null);
    if (!res.ok) { alert(data.error || "صار خطأ بالحذف"); return; }
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  }

  return (
    <div style={s.card}>
      <h3 style={s.cardTitle}>مكتبة الملفات</h3>
      <p style={s.hint}>الملفات هون بتظهر بس لطلاب هاي الدفعة بصفحة الدورة عندهم. الحد الأقصى 25 ميجابايت لكل ملف.</p>
      <label style={{ ...s.saveBtn, display: "inline-block", cursor: "pointer", marginTop: "0.5rem" }}>
        {uploading ? "جاري الرفع..." : "+ رفع ملف جديد"}
        <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
      </label>
      {error && <p style={s.errorText}>{error}</p>}
      <hr style={s.hr} />
      {loading ? (
        <p style={s.loading}>جاري التحميل...</p>
      ) : files.length === 0 ? (
        <p style={s.hint}>ما في ملفات مرفوعة لهاي الدفعة لسا.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {files.map((f) => (
            <div key={f.id} style={s.rowItem}>
              <div style={{ minWidth: 0 }}>
                <a href={f.download_url || "#"} target="_blank" rel="noopener noreferrer" style={s.fileLink}>📄 {f.file_name}</a>
                <p style={{ ...s.mono, margin: "0.25rem 0 0" }}>{formatFileSize(f.file_size)} — {fmtDateTime(f.created_at)}</p>
              </div>
              <button onClick={() => handleDelete(f)} disabled={deletingId === f.id} style={s.btnDanger}>
                {deletingId === f.id ? "..." : "حذف"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- الإعلانات -------------------- */
function AnnouncementsTab({ batchId }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", message: "", link: "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/batches/${batchId}/announcements`);
    const data = await res.json();
    setAnnouncements(res.ok ? data.announcements || [] : []);
    setLoading(false);
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  async function handleSend(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    const res = await fetch(`/api/admin/batches/${batchId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setError(data.error || "صار خطأ بإرسال الإعلان"); return; }
    setForm({ title: "", message: "", link: "" });
    setAnnouncements((prev) => [data.announcement, ...prev]);
  }

  return (
    <div style={s.card}>
      <h3 style={s.cardTitle}>إعلانات الدفعة</h3>
      <p style={s.hint}>بيوصل الإعلان بس لطلاب هاي الدفعة، عن طريق مركز الإشعارات عندهم.</p>
      <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem", maxWidth: "480px" }}>
        <label style={s.label}>عنوان الإعلان</label>
        <input style={s.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً: تغيير موعد البث المباشر" required />
        <label style={s.label}>التفاصيل (اختياري)</label>
        <textarea style={{ ...s.input, minHeight: "80px", resize: "vertical", fontFamily: "inherit" }} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="تفاصيل الإعلان..." />
        <label style={s.label}>رابط (اختياري)</label>
        <input style={s.input} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="مثلاً: /live-sessions" />
        {error && <p style={s.errorText}>{error}</p>}
        <button type="submit" disabled={sending} style={{ ...s.saveBtn, alignSelf: "flex-start", marginTop: "0.5rem" }}>
          {sending ? "جاري الإرسال..." : "إرسال للدفعة"}
        </button>
      </form>

      <hr style={s.hr} />
      <p style={{ ...s.label, marginTop: 0 }}>إعلانات سابقة</p>
      {loading ? (
        <p style={s.loading}>جاري التحميل...</p>
      ) : announcements.length === 0 ? (
        <p style={s.hint}>ما في إعلانات مُرسلة لهاي الدفعة لسا.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {announcements.map((a) => (
            <div key={a.id} style={s.rowItem}>
              <div style={{ minWidth: 0 }}>
                <span style={{ color: "#EAECEF", fontSize: "0.86rem", fontWeight: 700 }}>{a.title}</span>
                {a.message && <p style={{ color: "#999", fontSize: "0.8rem", margin: "0.35rem 0 0" }}>{a.message}</p>}
                <p style={{ ...s.mono, margin: "0.35rem 0 0" }}>{fmtDateTime(a.created_at)}</p>
              </div>
              <span style={s.mono}>{a.recipients_count} طالب</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- الشهادات -------------------- */
function CertificatesTab({ batchId }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/batches/${batchId}/certificates`);
    const data = await res.json();
    setStudents(res.ok ? data.students || [] : []);
    setLoading(false);
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  async function handleIssue(student) {
    setError("");
    setBusyId(student.user_id);
    const res = await fetch(`/api/admin/batches/${batchId}/certificates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: student.user_id }),
    });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) { setError(data.error || "صار خطأ بالإصدار"); return; }
    setStudents((prev) => prev.map((s2) => (s2.user_id === student.user_id ? { ...s2, certificate: data.certificate } : s2)));
  }

  async function handleRevoke(student) {
    if (!confirm(`متأكدة إنك بدك تسحبي شهادة "${student.username}"؟`)) return;
    setBusyId(student.user_id);
    const res = await fetch(`/api/admin/batches/${batchId}/certificates/${student.certificate.id}`, { method: "DELETE" });
    const data = await res.json();
    setBusyId(null);
    if (!res.ok) { alert(data.error || "صار خطأ بالسحب"); return; }
    setStudents((prev) => prev.map((s2) => (s2.user_id === student.user_id ? { ...s2, certificate: null } : s2)));
  }

  return (
    <div style={s.card}>
      <h3 style={s.cardTitle}>شهادات الدفعة</h3>
      <p style={s.hint}>الشهادة بتصدر تلقائيًا للطالب لما يخلّص 100% من محاضرات دفعته، أو تقدري تصدريها يدويًا بغض النظر عن نسبته.</p>
      {error && <p style={s.errorText}>{error}</p>}
      <hr style={s.hr} />
      {loading ? (
        <p style={s.loading}>جاري التحميل...</p>
      ) : students.length === 0 ? (
        <p style={s.hint}>ما في طلاب مسجّلين بهاي الدفعة لسا.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {students.map((st) => (
            <div key={st.user_id} style={s.rowItem}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#eee" }}>{st.username}</p>
                <p style={{ ...s.mono, margin: "0.25rem 0 0" }}>
                  {st.progress.completed}/{st.progress.total} محاضرة ({st.progress.percent}%)
                  {st.certificate && <> — {st.certificate.is_automatic ? "صادرة تلقائيًا" : "صادرة يدويًا"} بتاريخ {fmtDateTime(st.certificate.issued_at)}</>}
                </p>
              </div>
              {st.certificate ? (
                <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                  <a href={`/certificate/${st.certificate.certificate_code}`} target="_blank" rel="noopener noreferrer" style={s.btnEdit}>عرض</a>
                  <button onClick={() => handleRevoke(st)} disabled={busyId === st.user_id} style={s.btnDanger}>
                    {busyId === st.user_id ? "..." : "سحب"}
                  </button>
                </div>
              ) : (
                <button onClick={() => handleIssue(st)} disabled={busyId === st.user_id} style={s.saveBtn}>
                  {busyId === st.user_id ? "..." : "إصدار"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- الإعدادات -------------------- */
function SettingsTab({ batch, instructors, onSaved, onAction, router }) {
  const [form, setForm] = useState({
    name: batch.name || "",
    instructor_id: batch.instructor_id || "",
    start_date: batch.start_date || "",
    end_date: batch.end_date || "",
    seats_total: batch.seats_total ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/batches/${batch.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, instructor_id: form.instructor_id || null, seats_total: form.seats_total || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "صار خطأ بالحفظ"); return; }
    onSaved?.();
  }

  async function handleDelete() {
    if (!confirm(`متأكدة إنك بدك تحذفي دفعة "${batch.name}"؟ هالإجراء ما ممكن يترجع.`)) return;
    const res = await fetch(`/api/admin/batches/${batch.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) router.push("/admin/batches");
    else alert(data.error || "صار خطأ بالحذف");
  }

  return (
    <div>
      <div style={s.card}>
        <h3 style={s.cardTitle}>تعديل بيانات الدفعة</h3>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxWidth: "480px" }}>
          <label style={s.label}>اسم الدفعة</label>
          <input style={s.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

          <label style={s.label}>المدرب (اختياري)</label>
          <select style={s.input} value={form.instructor_id} onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}>
            <option value="">بدون تحديد</option>
            {instructors.map((i) => <option key={i.id} value={i.id}>{i.username}</option>)}
          </select>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label style={s.label}>تاريخ البداية</label>
              <input type="date" style={s.input} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.label}>تاريخ النهاية</label>
              <input type="date" style={s.input} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>

          <label style={s.label}>عدد المقاعد (اختياري)</label>
          <input type="number" min="1" style={s.input} value={form.seats_total} onChange={(e) => setForm({ ...form, seats_total: e.target.value })} placeholder="اتركيه فاضي = بدون حد أقصى" />

          {error && <p style={s.errorText}>{error}</p>}
          <button type="submit" disabled={saving} style={{ ...s.saveBtn, alignSelf: "flex-start", marginTop: "0.5rem" }}>
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </form>
      </div>

      <div style={{ ...s.card, marginTop: "1rem" }}>
        <h3 style={s.cardTitle}>إجراءات أخرى</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={() => onAction("duplicate")} style={s.btnEdit}>نسخ الدفعة</button>
          {!batch.is_archived && (
            <button onClick={() => onAction(batch.registration_status === "open" ? "close_registration" : "open_registration")} style={s.btnEdit}>
              {batch.registration_status === "open" ? "إغلاق التسجيل" : "فتح التسجيل"}
            </button>
          )}
          {!batch.is_default && (
            <button onClick={() => onAction(batch.is_archived ? "unarchive" : "archive")} style={s.btnEdit}>
              {batch.is_archived ? "فك الأرشفة" : "أرشفة"}
            </button>
          )}
          {!batch.is_default && (
            <button onClick={handleDelete} style={s.btnDanger}>حذف نهائي</button>
          )}
        </div>
        {batch.is_default && <p style={s.hint}>هاي الدفعة الافتراضية للدورة — ما فيها تتحذف ولا تتأرشف.</p>}
      </div>
    </div>
  );
}

const gold = "#D4AF37";
const ink = "#0B0E11";
const s = {
  page: { backgroundColor: ink, color: "#EAECEF", direction: "rtl", fontFamily: "'Inter', sans-serif", minHeight: "100vh", padding: "0 0 4rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "2rem 3rem 1rem", borderBottom: "1px solid #181A20" },
  headerBack: { color: "#999", fontSize: "0.8rem", textDecoration: "none" },
  headerTitle: { fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0" },
  tabsBar: { display: "flex", gap: "0.3rem", flexWrap: "wrap", padding: "1rem 3rem 0" },
  tabBtn: { background: "none", border: "1px solid #181A20", color: "#999", padding: "0.55rem 1rem", borderRadius: "6px 6px 0 0", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.4rem" },
  tabBtnActive: { color: gold, borderColor: gold, backgroundColor: "#12100a" },
  tabBtnDisabled: { opacity: 0.5, cursor: "default" },
  tabSoon: { fontSize: "0.62rem", color: "#666", backgroundColor: "#181A20", padding: "0.1rem 0.4rem", borderRadius: "3px" },
  tabBody: { padding: "1.5rem 3rem 2rem", borderTop: "1px solid #181A20" },
  overviewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" },
  overviewCard: { display: "flex", flexDirection: "column", gap: "0.4rem", backgroundColor: "#0d0d0d", border: "1px solid #181A20", borderRadius: "8px", padding: "1.1rem 1.3rem" },
  overviewValue: { fontSize: "1rem", fontWeight: 600, color: "#EAECEF" },
  card: { backgroundColor: "#0d0d0d", border: "1px solid #181A20", borderRadius: "8px", padding: "1.3rem" },
  cardTitle: { fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem" },
  hr: { border: "none", borderTop: "1px solid #222", margin: "1rem 0 0.75rem" },
  statLabel: { fontSize: "0.78rem", color: "#666" },
  progressBarBg: { width: "100%", height: "6px", backgroundColor: "#181A20", borderRadius: "999px", overflow: "hidden", marginTop: "0.3rem" },
  progressBarFill: { height: "100%", borderRadius: "999px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { backgroundColor: "#181A20", padding: "0.85rem 1rem", textAlign: "right", fontSize: "0.76rem", color: "#444", fontWeight: 500, borderBottom: "1px solid #111", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #0d0d0d" },
  td: { padding: "0.85rem 1rem", fontSize: "0.86rem", verticalAlign: "middle" },
  username: { color: "#EAECEF", fontWeight: 500 },
  mono: { fontFamily: "'JetBrains Mono', monospace", color: "#555", fontSize: "0.8rem" },
  label: { fontSize: "0.82rem", color: "#999", marginTop: "0.5rem" },
  input: { backgroundColor: "#181A20", border: "1px solid #222", color: "#EAECEF", padding: "0.65rem 0.9rem", borderRadius: "4px", fontSize: "0.88rem", outline: "none", fontFamily: "inherit" },
  hint: { fontSize: "0.75rem", color: "#555", marginTop: "0.15rem" },
  errorText: { color: "#ef5350", fontSize: "0.85rem", marginTop: "0.5rem" },
  loading: { textAlign: "center", padding: "2rem", color: "#444" },
  saveBtn: { backgroundColor: gold, color: "#000", border: "none", padding: "0.55rem 1.2rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700 },
  cancelBtn: { background: "none", border: "1px solid #222", color: "#999", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" },
  btnEdit: { backgroundColor: "#1a2a3a", color: "#5b9bd5", border: "1px solid #2a3a5a", padding: "0.45rem 0.9rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" },
  btnDanger: { backgroundColor: "#2a1a1a", color: "#ef5350", border: "1px solid #4a2a2a", padding: "0.45rem 0.9rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" },
  btnLive: { backgroundColor: "#F6465D", color: "#fff", border: "none", padding: "0.55rem 1.1rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, whiteSpace: "nowrap" },
  badgeDefault: { fontSize: "0.68rem", backgroundColor: "#1a2a3a", color: "#5b9bd5", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeActive: { fontSize: "0.68rem", backgroundColor: "#0a2a1e", color: "#02C076", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeUpcoming: { fontSize: "0.68rem", backgroundColor: "#1a2a3a", color: "#5b9bd5", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeEnded: { fontSize: "0.68rem", backgroundColor: "#181A20", color: "#999", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeArchived: { fontSize: "0.68rem", backgroundColor: "#2a1a1a", color: "#999", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeLive: { fontSize: "0.68rem", color: "#F6465D", backgroundColor: "#2a1418", padding: "0.15rem 0.5rem", borderRadius: "3px", fontWeight: 700 },
  badgeOpen: { fontSize: "0.68rem", color: "#02C076", backgroundColor: "#0a2a1e", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  badgeClosed: { fontSize: "0.68rem", color: "#999", backgroundColor: "#181A20", padding: "0.15rem 0.5rem", borderRadius: "3px" },
  sessionBtn: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#181A20", border: "1px solid #222", borderRadius: "6px", padding: "0.75rem 1rem", cursor: "pointer", width: "100%", textAlign: "right", fontFamily: "inherit" },
  rowItem: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#181A20", border: "1px solid #222", borderRadius: "6px", padding: "0.65rem 0.9rem", gap: "0.5rem" },
  fileLink: { color: "#5b9bd5", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" },
  backBtn: { color: "#999", fontSize: "0.85rem", textDecoration: "none", margin: "0 3rem" },
};
