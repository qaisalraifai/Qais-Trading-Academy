"use client";

import { useEffect, useRef, useState } from "react";
import { Columns2, Rows2, Square, Maximize2, Minimize2 } from "lucide-react";
import ReplayClient from "./ReplayClient";

/* ═══════════════════════════════════════════════════════════════════════════
   مساحة عمل الاستعراض — شارت واحد أو **شارتان كاملان مستقلان**.

   ---------------------------------------------------------------------------
   ليش شارتان كاملان بدل «لوحة مقارنة»:

   اللوحة القديمة كانت شارت تاني بمحور وقت منفصل ومصدر بيانات مختلف، ولازم
   نجبرهن يبدوا متطابقين. وكل مشاكلها كانت فروع من هالجذر — انزياح بالمحاذاة،
   خط تقاطع بيفلت، فراغات بالشموع، مزامنة بتنفلت. انحذفت بالكامل.

   هون كل شارت **نسخة كاملة** من نفس الكومبوننت: نفس المحمّل (فبنفس العمق
   والتخزين وتمديد الذيل والتحميل على مرحلتين)، نفس الأدوات، نفس الرسم.
   ما في محاذاة تتكسر لأنه ما في محاذاة مفروضة أصلاً.

   ⚠️ **وهاد ما بيزيد العمق.** الشارتان بيستعملوا نفس المزوّد فنفس حدوده.
   العمق سؤال مزوّد وانحسم عنده — شوفي `compare-pane-depth` بالذاكرة.

   ⚠️ **ولا في مزامنة.** مطفية عمداً بهالمرحلة: مزامنة بتكذب أسوأ من غيابها،
   وهاد بالضبط اللي علّمتنا إياه اللوحة القديمة. المرحلة الجاية بتضيفها
   **كخيار معلن** بأزرار مستقلة (رمز · فريم · نافذة · خط تقاطع).
   ═══════════════════════════════════════════════════════════════════════════ */

const LAYOUT_KEY = "qta_replay_layout_v1";

/* ⚠️ رمز البداية للوحة التانية. مش «مترابط» بأي معنى تحليلي — مجرد نقطة
   انطلاق معقولة، والمستخدم بيبدّله من نفس الشارت زي أي شارت تاني. */
const SECOND_PANE_ASSET = "SPX500";

export default function ReplayWorkspace({ userId }) {
  /* "single" · "rows" (فوق بعض) · "cols" (جنب بعض) */
  const [layout, setLayout] = useState("single");
  const [ready, setReady] = useState(false);

  /* ═══════════════════════════════════════════════════════════════════════
     الشاشة الكاملة **لمساحة العمل كلها** مش لشارت واحد.
     ---------------------------------------------------------------------
     زر الشاشة الكاملة جوّا الشارت بيرفع **حاويته هو** — فبالتخطيط المقسوم
     بيختفي الشارت التاني وشريط التخطيط معه، وما بيبقى مجال تبدّل التخطيط
     وأنت داخل. هون الحاوية الأعلى هي اللي بترتفع، فالاتنين بيضلوا ظاهرين
     والأزرار شغّالة.

     ⚠️ وزر الشارت الداخلي انترك كما هو — مفيد بالتخطيط المفرد لما تبغى
     شارتاً واحداً بلا أي شي حواليه. */
  const rootRef = useRef(null);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement === rootRef.current) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.();
  }

  /* ⚠️ القراءة بتأثير مش بالحالة الابتدائية: `localStorage` ما بتنقرا على
     الخادم، وقراءتها وقت أول رندر بتخالف بين الخادم والمتصفّح. */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_KEY);
      if (saved === "rows" || saved === "cols" || saved === "single") setLayout(saved);
    } catch {}
    setReady(true);
  }, []);

  function pick(next) {
    setLayout(next);
    try { window.localStorage.setItem(LAYOUT_KEY, next); } catch {}
  }

  const split = layout !== "single";

  const btn = (value, Icon, title) => (
    <button
      type="button"
      onClick={() => pick(value)}
      title={title}
      aria-label={title}
      aria-pressed={layout === value}
      style={{
        width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 3, cursor: "pointer", flexShrink: 0,
        border: "1px solid " + (layout === value ? "#C9A961" : "transparent"),
        background: layout === value ? "#C9A96122" : "none",
        color: layout === value ? "#E8D9A8" : "#A79FC4",
      }}
    >
      <Icon size={15} strokeWidth={1.75} aria-hidden />
    </button>
  );

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex", flexDirection: "column", flex: 1, minHeight: 0,
        ...(isFs ? { background: "#0A0614", padding: "0.5rem" } : null),
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 6, paddingInlineStart: 2,
        }}
      >
        <span style={{ fontSize: 11.5, color: "#6E6690", marginInlineEnd: 2 }}>التخطيط</span>
        {btn("single", Square, "شارت واحد")}
        {btn("rows", Rows2, "شارتان فوق بعض")}
        {btn("cols", Columns2, "شارتان جنب بعض")}
        <div style={{ width: 1, height: 18, background: "#2A2145", margin: "0 4px" }} />
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFs ? "خروج من الشاشة الكاملة" : "شاشة كاملة لمساحة العمل"}
          aria-label={isFs ? "خروج من الشاشة الكاملة" : "شاشة كاملة لمساحة العمل"}
          style={{
            width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 3, cursor: "pointer", flexShrink: 0,
            border: "1px solid " + (isFs ? "#C9A961" : "transparent"),
            background: isFs ? "#C9A96122" : "none",
            color: isFs ? "#E8D9A8" : "#A79FC4",
          }}
        >
          {isFs
            ? <Minimize2 size={15} strokeWidth={1.75} aria-hidden />
            : <Maximize2 size={15} strokeWidth={1.75} aria-hidden />}
        </button>
      </div>

      {/* ⚠️ ما بنركّب اللوحة التانية قبل ما نقرا التخطيط المحفوظ — وإلا
          بتنركّب وتنهدم فوراً، يعني طلب بيانات كامل بلا فايدة. */}
      <div
        style={{
          display: "flex",
          flexDirection: layout === "cols" ? "row" : "column",
          gap: split ? 8 : 0,
          flex: 1,
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0 }}>
          {/* ⚠️ بالشاشة الكاملة كمان — الحاوية بتصير هي النافذة، فالقياس
              منها أدقّ من الحساب المبني على موضع العنصر بالصفحة. */}
          <ReplayClient userId={userId} paneId="main" isPrimary fillContainer={split || isFs} />
        </div>

        {ready && split && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0 }}>
            <ReplayClient
              userId={userId}
              paneId="b"
              isPrimary={false}
              initialAsset={SECOND_PANE_ASSET}
              fillContainer
            />
          </div>
        )}
      </div>
    </div>
  );
}
