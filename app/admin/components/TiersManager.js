"use client";
import { useEffect, useState } from "react";
import { gold, s as baseStyles, glass, transition } from "../styles";

const EMPTY = { code: "", title_ar: "", badge_icon: "🏅", color_hex: "#D4AF37", min_active_clients: 0, sort_order: 0 };

export default function TiersManager() {
  const [tiers, setTiers] = useState([]);
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
      const res = await fetch("/api/admin/affiliate-tiers");
      const json = await res.json();
      setTiers(json.tiers || []);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({ code: t.code, title_ar: t.title_ar, badge_icon: t.badge_icon, color_hex: t.color_hex, min_active_clients: t.min_active_clients, sort_order: t.sort_order });
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
        ? await fetch("/api/admin/affiliate-tiers", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, ...form }),
          })
        : await fetch("/api/admin/affiliate-tiers", {
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

  async function toggleActive(t) {
    await fetch("/api/admin/affiliate-tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
    });
    await load();
  }

  async function remove(id) {
    if (!window.confirm("متأكد إنك بدك تحذف هالمستوى؟")) return;
    await fetch(`/api/admin/affiliate-tiers?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.3rem", lineHeight: 1.8 }}>
        المستويات ديناميكية بالكامل — تُحسب حيًّا من عدد العملاء النشطين حالياً عند كل مسوّق (مو تراكمياً).
        رتّب المستويات حسب "الحد الأدنى من العملاء النشطين" تصاعدياً.
      </p>

      <div style={{ ...glass, padding: "1.4rem", marginBottom: "1.5rem", maxWidth: 620 }}>
        <p style={{ color: gold, fontSize: "0.85rem", fontWeight: 700, marginBottom: "1rem" }}>
          {editingId ? "تعديل مستوى" : "+ إضافة مستوى جديد"}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
          <Field label="الكود (إنجليزي، فريد)">
            <input style={styles.input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editingId} />
          </Field>
          <Field label="الاسم بالعربي/الإنجليزي">
            <input style={styles.input} value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
          </Field>
          <Field label="الشارة (إيموجي)">
            <input style={styles.input} value={form.badge_icon} onChange={(e) => setForm({ ...form, badge_icon: e.target.value })} />
          </Field>
          <Field label="اللون">
            <input type="color" style={{ ...styles.input, padding: 4, height: 42 }} value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} />
          </Field>
          <Field label="الحد الأدنى من العملاء النشطين">
            <input type="number" style={styles.input} value={form.min_active_clients} onChange={(e) => setForm({ ...form, min_active_clients: e.target.value })} />
          </Field>
          <Field label="ترتيب العرض">
            <input type="number" style={styles.input} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          </Field>
        </div>
        {error && <p style={{ color: "#F6465D", fontSize: "0.78rem", marginBottom: 8 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={saving} onClick={save} style={{ ...baseStyles.btn, ...baseStyles.btnGold }}>
            {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "إضافة"}
          </button>
          {editingId && (
            <button onClick={resetForm} style={baseStyles.btn}>إلغاء</button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#666" }}>جاري التحميل...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>الشارة</th>
                <th style={styles.th}>الاسم</th>
                <th style={styles.th}>الحد الأدنى (عملاء نشطين)</th>
                <th style={styles.th}>الحالة</th>
                <th style={styles.th}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id}>
                  <td style={styles.td}>
                    <span style={{ fontSize: "1.3rem" }}>{t.badge_icon}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ color: t.color_hex, fontWeight: 700 }}>{t.title_ar}</span>
                  </td>
                  <td style={styles.td}>{t.min_active_clients}+</td>
                  <td style={styles.td}>
                    <span style={{ color: t.is_active ? "#4CAF50" : "#888" }}>{t.is_active ? "مفعّل" : "معطّل"}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => startEdit(t)} style={baseStyles.btn}>تعديل</button>
                      <button onClick={() => toggleActive(t)} style={baseStyles.btn}>{t.is_active ? "تعطيل" : "تفعيل"}</button>
                      <button onClick={() => remove(t.id)} style={{ ...baseStyles.btn, ...baseStyles.btnDanger }}>حذف</button>
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
  input: { width: "100%", background: "#080808", border: "1px solid #22252B", color: "#EAECEF", padding: "0.6rem 0.8rem", borderRadius: 6, fontSize: "0.85rem" },
};
