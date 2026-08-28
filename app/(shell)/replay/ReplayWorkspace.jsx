"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   ReplayWorkspace — طبقة تخطيط الشارتات المتعدّدة
   ---------------------------------------------------------------------------
   طلبه: «أريد إضافة ميزة Multi-Chart إلى أداة Replay الحالية… لا تعمل إعادة
   بناء للـReplay ولا refactor كبير».

   فهاي الطبقة **فوق** `ReplayClient` مش جوّاه: بتملك التخطيط والمزامنة
   واللوحة النشطة، وبتكرّر نفس الكومبوننت بلا ما تلمس محرّك الشارت ولا أدوات
   الرسم ولا حسابات الشموع.

   ═══ ليش كل لوحة نسخة كاملة ═══
   `ReplayClient` بيملك حالته كلها جوّاه (الرمز · الفريم · الرسومات · نقطة
   القص · المؤشرات). فتكراره بيعطي **عزلاً تلقائياً**: رسمة لوحة ما بتقدر
   تظهر بلوحة تانية، لأنها أصلاً بمصفوفة تانية بنسخة تانية.

   البديل — تحويل الحالة لمصفوفات جوّا كومبوننت واحد — كان بيعني لمس ٩٠
   `useState` و٦٥ `useEffect`، وهاد بالضبط الـrefactor الكبير اللي منعه.

   ═══ مفاتيح التخزين ═══
   `paneId="main"` بيحتفظ بالمفاتيح القديمة حرفياً، فأي جلسة قص محفوظة عند
   المستخدمين بتفتح زي ما هي. اللوحات الجديدة بتاخد مفاتيح منمّطة.

   ⚠️ **هالطبقة انبنت مرة قبل وانرجعت** (فرع `backup/pre-revert-2026-08-27`).
      الأعطال اللي وقعت فيها وقتها مذكورة بمكانها تحت — مش تخمين، مقيسة.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, Grid2x2, LayoutGrid, Rows2, Square, X } from "lucide-react";
import ReplayClient from "./ReplayClient";

const LAYOUT_KEY = "qta_replay_layout_v1";
const SYNC_KEY = "qta_replay_sync_v1";

/* التخطيطات: `panes` عدد اللوحات · `css` شبكة CSS.
   ⚠️ الأسماء ثابتة لأنها بتنحفظ بالمتصفح — تغييرها بيفقد تخطيط المستخدم. */
const LAYOUTS = {
  single: { panes: 1, label: "شارت واحد", Icon: Square, cols: "1fr", rows: "1fr" },
  cols2: { panes: 2, label: "شارتين أفقي", Icon: Columns2, cols: "1fr 1fr", rows: "1fr" },
  rows2: { panes: 2, label: "شارتين عمودي", Icon: Rows2, cols: "1fr", rows: "1fr 1fr" },
  three: { panes: 3, label: "تلاتة شارتات", Icon: LayoutGrid, cols: "1fr 1fr", rows: "1fr 1fr" },
  four: { panes: 4, label: "أربعة شارتات", Icon: Grid2x2, cols: "1fr 1fr", rows: "1fr 1fr" },
};
const PANE_IDS = ["main", "B", "C", "D"];

export default function ReplayWorkspace({ userId }) {
  const [layout, setLayout] = useState("single");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePane, setActivePane] = useState("main");
  const [sync, setSync] = useState({ on: true, time: true, crosshair: false, zoom: false });
  /* أضيق من هيك ما بتنقسم الشاشة — عمود شارت أقل من ~٤٢٠ بكسل بيصير غير
     مقروء، وطلبه صريح: «على الشاشات الصغيرة لا تحاول ضغط ٤ شارتات». */
  const [maxPanes, setMaxPanes] = useState(4);

  useEffect(() => {
    try {
      const l = localStorage.getItem(LAYOUT_KEY);
      if (l && LAYOUTS[l]) setLayout(l);
      const s = localStorage.getItem(SYNC_KEY);
      if (s) setSync((p) => ({ ...p, ...JSON.parse(s) }));
    } catch { /* تخزين محلي معطّل — الافتراضي بيكفي */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(LAYOUT_KEY, layout); } catch {} }, [layout]);
  useEffect(() => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch {} }, [sync]);

  /* الحد حسب العرض الفعلي — بلا تخمين نقاط توقّف. */
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      setMaxPanes(w < 900 ? 1 : w < 1400 ? 2 : 4);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* ⚠️ **الفتحات لازم تكون مراجع ثابتة الهوية.**
     أول تنفيذ استعمل `ref={(n) => setSlot("top", n)}` — دالة جديدة كل رندر،
     فReact بينده القديمة بـnull والجديدة بالعنصر مع **كل** رندر، والحالة
     بتتغيّر، فبيرندر من جديد: حلقة لا نهائية (React #185) بتجمّد الصفحة.
     `useCallback` بمصفوفة تبعيات فاضية بتثبّت الهوية. */
  const [slots, setSlots] = useState({ top: null });
  const setTopSlot = useCallback((node) => {
    setSlots((p) => (p.top === node ? p : { ...p, top: node }));
  }, []);

  const conf = LAYOUTS[layout] || LAYOUTS.single;
  const paneCount = Math.min(conf.panes, maxPanes);
  const multi = paneCount > 1;
  const ids = PANE_IDS.slice(0, paneCount);
  /* اللوحة النشطة لازم تكون موجودة فعلاً — بعد التصغير ممكن تختفي. */
  const active = ids.includes(activePane) ? activePane : "main";

  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative" }}>
      {/* شريط مشترك: اللوحة النشطة بتنقل شريطها لهون بـcreatePortal.
          بالوضع المفرد بيضل فاضياً والشريط بينرسم جوّا الشارت زي ما كان. */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div ref={setTopSlot} style={{ flex: 1, minWidth: 0 }} />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title="تخطيط الشارتات"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0.4rem 0.7rem", borderRadius: 4, cursor: "pointer",
            border: `1px solid ${menuOpen ? "#6D4AFF" : "#2A2145"}`,
            background: menuOpen ? "#1A1230" : "transparent",
            color: menuOpen ? "#C9BEFF" : "#A79FC4",
            fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
            transition: "background 0.12s ease, border-color 0.12s ease",
          }}
        >
          <LayoutGrid size={15} strokeWidth={1.9} aria-hidden />
          تخطيط
        </button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "absolute", top: 42, insetInlineEnd: 0, zIndex: 40, width: 232,
            background: "#0F0B1C", border: "1px solid #2A2145", borderRadius: 6,
            padding: "0.7rem", boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: "#C9BEFF" }}>تخطيط الشارت</span>
            <button type="button" onClick={() => setMenuOpen(false)} style={{ background: "none", border: "none", color: "#6E6690", cursor: "pointer", padding: 2 }}>
              <X size={14} aria-hidden />
            </button>
          </div>

          {Object.entries(LAYOUTS).map(([key, c]) => {
            const blocked = c.panes > maxPanes;
            const on = key === layout;
            const Icon = c.Icon;
            return (
              <button
                key={key}
                type="button"
                disabled={blocked}
                onClick={() => { setLayout(key); setMenuOpen(false); }}
                title={blocked ? "الشاشة أضيق من أن تعرض هالعدد بشكل مقروء" : c.label}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: "0.45rem 0.5rem", marginBottom: 2, borderRadius: 4,
                  border: `1px solid ${on ? "#6D4AFF" : "transparent"}`,
                  background: on ? "#191130" : "transparent",
                  color: blocked ? "#4A4363" : on ? "#C9BEFF" : "#A79FC4",
                  cursor: blocked ? "not-allowed" : "pointer", fontSize: 12.5,
                  textAlign: "start", transition: "background 0.12s ease",
                }}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden />
                {c.label}
              </button>
            );
          })}

          <div style={{ height: 1, background: "#1C1630", margin: "0.6rem 0" }} />

          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontSize: 12.5, color: "#C9BEFF", fontWeight: 700 }}>
            مزامنة الشارتات
            <input
              type="checkbox"
              checked={sync.on}
              onChange={(e) => setSync((p) => ({ ...p, on: e.target.checked }))}
              style={{ accentColor: "#6D4AFF", width: 15, height: 15, cursor: "pointer" }}
            />
          </label>

          {/* ⚠️ ولا مزامنة إجبارية: الرمز والفريم بيضلوا مستقلين تماماً —
              طلبه الصريح. المزامنة بس على الزمن/المؤشر/الزوم. */}
          <div style={{ marginTop: 6, opacity: sync.on ? 1 : 0.45, pointerEvents: sync.on ? "auto" : "none" }}>
            {[
              ["time", "الوقت ونقطة القص"],
              ["crosshair", "المؤشر"],
              ["zoom", "الزوم والتحريك"],
            ].map(([k, label]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 7, padding: "0.25rem 0", cursor: "pointer", fontSize: 12, color: "#A79FC4" }}>
                <input
                  type="checkbox"
                  checked={!!sync[k]}
                  onChange={(e) => setSync((p) => ({ ...p, [k]: e.target.checked }))}
                  style={{ accentColor: "#6D4AFF", width: 14, height: 14, cursor: "pointer" }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1, minHeight: 0, display: "grid", gap: multi ? 6 : 0,
          gridTemplateColumns: paneCount === 1 ? "1fr" : conf.cols,
          gridTemplateRows: paneCount === 1 ? "1fr" : conf.rows,
        }}
      >
        {ids.map((id, i) => {
          const isActive = id === active;
          /* تلات شارتات: الأول بياخد العمود كامل. */
          const span = conf.panes === 3 && i === 0 ? { gridRow: "1 / span 2" } : null;
          return (
            <div
              key={id}
              style={{
                minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column",
                position: "relative", borderRadius: 4, ...span,
                /* ⚠️ `outline` مش `border`: الحدّ بيغيّر مقاس الصندوق فبيقفز
                   الشارت كل ما تتبدّل اللوحة النشطة. */
                outline: multi ? `1px solid ${isActive ? "#6D4AFF" : "#1C1630"}` : "none",
                outlineOffset: -1,
                transition: "outline-color 0.12s ease",
              }}
            >
              <ReplayClient
                userId={userId}
                paneId={id}
                fillContainer={multi}
                chromeSlots={multi ? slots : null}
                chromeActive={isActive}
                onActivate={multi ? () => setActivePane(id) : null}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
