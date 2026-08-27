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

  /* ═══════════════════════════════════════════════════════════════════════
     شريط أدوات **واحد** بدل واحد لكل شارت.
     ---------------------------------------------------------------------
     الشريطان متطابقان شكلاً، وتكرارهن بياكل مساحة وبيربك: على أي شارت
     بتشتغل؟ فصار في فتحتان مشتركتان (علوية + جانبية)، واللوحة **النشطة**
     وحدها بتطبع أشرطتها فيهن بـportal.

     يعني الأدوات دايماً بمكان واحد، وبتشتغل على الشارت اللي ماسكه.

     ⚠️ **النشاط بينحدّد بأول ضغطة** (`pointerDownCapture`) — بالالتقاط عشان
     يوصل قبل ما الشارت نفسه يمسك الحدث للرسم أو السحب. وبيضل شغّال حتى لو
     كانت الضغطة أصلاً على أداة رسم.
     ⚠️ ومنستنى الفتحتين ينركّبوا قبل ما نمرّرهن — `createPortal` بده عنصر
     DOM موجود فعلاً وقت الرندر، مش ref فاضي.
     ═══════════════════════════════════════════════════════════════════════ */
  /* 🔴 **مراجع استدعاء مش قراءة لمرة وحدة.**
     أول نسخة قرأت المراجع بتأثير التركيب — وقتها `layout` لسا `"single"`
     (بينقرا من التخزين بنفس التأثير)، يعني الفتحات مش مركّبة أصلاً فالقيم
     كانت `null` والبوابات ما طبعت ولا شريط.
     بمرجع الاستدعاء، الحالة بتتحدّث لحظة ما ينركّب العنصر فعلاً. */
  const [slots, setSlots] = useState({ top: null, tools: null, bottom: null });
  const setSlot = (name) => (node) =>
    setSlots((prev) => (prev[name] === node ? prev : { ...prev, [name]: node }));
  const [activePane, setActivePane] = useState("main");

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

  /* حاوية لوحة: بتلتقط الضغطة عشان تصير هي النشطة، وبتعلّم النشطة بحدّ خفيف
     ⚠️ الحدّ **بلا إزاحة تخطيط** (`outline` مش `border`) — وإلا كل تبديل نشاط
     بيغيّر عرض الشارت المتاح فيعيد حسابه بلا داعٍ. */
  const paneBox = (id, node) => (
    <div
      onPointerDownCapture={() => setActivePane(id)}
      style={{
        display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0,
        position: "relative",
        outline: split && activePane === id ? "1px solid #C9A96155" : "1px solid transparent",
        outlineOffset: -1,
        borderRadius: 4,
      }}
    >
      {node}
    </div>
  );

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

      {/* الفتحة المشتركة للشريط العلوي — بتنعرض بس بالتخطيط المقسوم */}
      {split && <div ref={setSlot("top")} />}

      {/* ⚠️ ما بنركّب اللوحة التانية قبل ما نقرا التخطيط المحفوظ — وإلا
          بتنركّب وتنهدم فوراً، يعني طلب بيانات كامل بلا فايدة. */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0, gap: split ? 6 : 0 }}>
        {/* الفتحة المشتركة لشريط الرسم الجانبي */}
        {split && <div ref={setSlot("tools")} style={{ flexShrink: 0 }} />}

        <div
          style={{
            display: "flex",
            flexDirection: layout === "cols" ? "row" : "column",
            flex: 1,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {paneBox("main", <ReplayClient
            userId={userId}
            paneId="main"
            isPrimary
            /* ⚠️ بالشاشة الكاملة كمان — الحاوية بتصير هي النافذة، فالقياس
               منها أدقّ من الحساب المبني على موضع العنصر بالصفحة. */
            fillContainer={split || isFs}
            chromeSlots={split ? slots : null}
            chromeActive={activePane === "main"}
            onRequestFullscreen={split ? toggleFullscreen : null}
          />)}

          {/* 🔴 الخط الرفيع بين الشارتين — بيسهّل تتبّع نفس اللحظة بينهن */}
          {ready && split && (
            <div
              style={{
                flexShrink: 0,
                background: "#2A2145",
                ...(layout === "cols" ? { width: 1, margin: "0 6px" } : { height: 1, margin: "6px 0" }),
              }}
            />
          )}

          {ready && split && paneBox("b", <ReplayClient
            userId={userId}
            paneId="b"
            isPrimary={false}
            initialAsset={SECOND_PANE_ASSET}
            fillContainer
            chromeSlots={slots}
            chromeActive={activePane === "b"}
            onRequestFullscreen={toggleFullscreen}
          />)}
        </div>
      </div>

      {/* الفتحة المشتركة للشريط السفلي (المدى الزمني + الساعة) */}
      {split && <div ref={setSlot("bottom")} />}
    </div>
  );
}
