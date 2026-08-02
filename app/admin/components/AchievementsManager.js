"use client";
import { useEffect, useState } from "react";
import { gold, s as baseStyles, glass } from "../styles";

const EMPTY = { code: "", title_ar: "", description_ar: "", icon: "🏆", metric: "total_referrals", threshold: 10, bonus_amount: 0, sort_order: 0 };

const METRIC_LABELS = {
  total_referrals: "إجمالي عدد الإحالات (تراكمي)",
  total_earned: "إجمالي الأرباح التاريخية ($)",
  monthly_top_rank: "أعلى مسوّق بالشهر (يُدار يدويًا)",
};

export default function AchievementsManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/achievements");
      const json = await res.json();
      setItems(json.achievements || []);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(a) {
    setEditingId(a.id);
    setForm({
      code: a.code,
      title_ar: a.title_ar,
      description_ar: a.description_ar || "",
      icon: a.icon,
      metric: a.metric,
      threshold: a.threshold,
      bonus_amount: a.bonus_amount,
      sort_order: a.sort_order,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function save() {
    if (!form.code.trim() || !form.title_ar.trim()) {
      setError("الكود والاسم مطلوبين");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = editingId
        ? await fetch("/api/admin/achievements", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, ...form }),
          })
        : await fetch("/api/admin/achievements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "خطأ");
      resetForm();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a) {
    await fetch("/api/admin/achievements", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, is_active: !a.is_active }),
    });
    await load();
  }

  async function remove(id) {
    if (!window.confirm("متأكد إنك بدك تحذف هالإنجاز؟")) return;
    await fetch(`/api/admin/achievements?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.3rem", lineHeight: 1.8 }}>
        كل الإنجازات تراكمية (Lifetime) — أول مرة يتحقق الشرط تُصرف المكافأة (لو موجودة) للمحفظة مباشرة، ولا تُفقد أبداً حتى لو تراجعت أرقام المسوّق لاحقاً.
        سيب "مكافأة مالية" على 0 لو بدك يكون إنجاز شارة بس بدون بونص.
      </p>

      <div style={{ ...glass, padding: "1.4rem", marginBottom: "1.5rem", maxWidth: 640 }}>
        <p style={{ color: gold, fontSize: "0.85rem", fontWeight: 700, marginBottom: "1rem" }}>
          {editingId ? "تعديل إنجاز" : "+ إضافة إنجاز جديد"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
          <Field label="الكود (إنجليزي، فريد)">
            <input style={styles.input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editingId} />
          </Field>
          <Field label="العنوان">
            <input style={styles.input} value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
          </Field>
          <Field label="الأيقونة (إيموجي)">
            <input style={styles.input} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </Field>
          <Field label="المقياس">
            <select style={styles.input} value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })}>
              {Object.entries(METRIC_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="الحد المطلوب لفتح الإنجاز">
            <input type="number" style={styles.input} value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          </Field>
          <Field label="مكافأة مالية ($)">
            <input type="number" style={styles.input} value={form.bonus_amount} onChange={(e) => setForm({ ...form, bonus_amount: e.target.value })} />
          </Field>
          <Field label="ترتيب العرض">
            <input type="number" style={styles.input} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </Field>
          <Field label="الوصف">
            <input style={styles.input} value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
          </Field>
        </div>
        {error && <p style={{ color: "#E5484D", fontSize: "0.78rem", marginBottom: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={saving} onClick={save} style={{ ...baseStyles.btn, ...baseStyles.btnGold }}>
            {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "إضافة"}
          </button>
          {editingId && <button onClick={resetForm} style={baseStyles.btn}>إلغاء</button>}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#666" }}>جاري التحميل...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>الإنجاز</th>
                <th style={styles.th}>المقياس / الحد</th>
                <th style={styles.th}>المكافأة</th>
                <th style={styles.th}>الحالة</th>
                <th style={styles.th}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td style={styles.td}>{a.icon} {a.title_ar}</td>
                  <td style={styles.td}>{METRIC_LABELS[a.metric] || a.metric} — {a.threshold}</td>
                  <td style={styles.td}>{a.bonus_amount > 0 ? `$${a.bonus_amount}` : "—"}</td>
                  <td style={styles.td}>
                    <span style={{ color: a.is_active ? "#3DBB6E" : "#888" }}>{a.is_active ? "مفعّل" : "معطّل"}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(a)} style={baseStyles.btn}>تعديل</button>
                      <button onClick={() => toggleActive(a)} style={baseStyles.btn}>{a.is_active ? "تعطيل" : "تفعيل"}</button>
                      <button onClick={() => remove(a.id)} style={{ ...baseStyles.btn, ...baseStyles.btnDanger }}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", color: "#888", fontSize: "0.75rem", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "right", color: "#666", fontSize: "0.75rem", padding: "0.7rem", borderBottom: "1px solid #1c1c1c" },
  td: { padding: "0.7rem", fontSize: "0.85rem", color: "#C8C0B0", borderBottom: "1px solid #1c1c1c" },
  input: { width: "100%", background: "#080808", border: "1px solid #141517", color: "#EAECEF", padding: "0.6rem 0.8rem", borderRadius: 6, fontSize: "0.85rem" },
};
