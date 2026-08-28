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

/* ⚠️ **بلا بادئة `qta_` عمداً.** `user-settings-sync` بيزامن كل مفتاح
   بهالبادئة مع الحساب، و**بيعيد تحميل الصفحة** عند أول اختلاف — عشان الحالات
   اللي بتنقرا مرة وحدة عند الإقلاع تاخد القيم الجاية من الحساب.
   مقيس محلياً: كل تبديل تخطيط كان يطلق إعادة تحميل.
   وتخطيط الشاشة تفضيل **جهاز** مش إعداد حساب — شاشة الموبايل ما بدها نفس
   تقسيم شاشة المكتب. فبيضل محلياً وبس. */
const LAYOUT_KEY = "replayLayout_v1";
const SYNC_KEY = "replaySync_v1";

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

  /* ═══════════════════════════════════════════════════════════════════════
     🔴 **الكتابة عند الإقلاع كانت تعمل حلقة إعادة تحميل لا نهائية.**
     -----------------------------------------------------------------------
     `lib/user-settings-sync.js` بيراقب **كل** مفتاح يبدأ بـ`qta_` وبيزامنه
     مع الخادم؛ ولما يلاقي فرقاً بيكتب المحلي و**بيعمل reload**. عنده حارس
     `reloadedThisSession`، بس الـreload بيخلق سياق JS جديد فالحارس بينصفّر.

     فالكتابة عند الإقلاع كانت: نكتب المفتاح → الخادم ما عنده → فرق →
     reload → نكتب من جديد… بلا نهاية. مقيس محلياً: `GET /replay` بيتكرر
     وطلبات الشموع بتتعاد، والشارت ما بيوصل يرسم أبداً.

     والكتابة عند الإقلاع **غلط بذاتها**: القيمة الافتراضية مش اختيار
     المستخدم، فما بتستاهل تنكتب ولا تنزامن. بنكتب بس لما يبدّل فعلاً.
     ═══════════════════════════════════════════════════════════════════════ */
  const hydrated = useRef(false);
  useEffect(() => {
    try {
      const l = localStorage.getItem(LAYOUT_KEY);
      if (l && LAYOUTS[l]) setLayout(l);
      const s = localStorage.getItem(SYNC_KEY);
      if (s) setSync((p) => ({ ...p, ...JSON.parse(s) }));
    } catch { /* تخزين محلي معطّل — الافتراضي بيكفي */ }
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(LAYOUT_KEY, layout); } catch {}
  }, [layout]);
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch {}
  }, [sync]);
  /* ═══════════════════════════════════════════════════════════════════════
     🔴 **الحارس كان بينرفع بدري فبيمسح التخطيط المحفوظ.**
     -----------------------------------------------------------------------
     كان `hydrated.current = true` بآخر تأثير القراءة. وتأثيرات React بتنفّذ
     **بترتيب التصريح على نفس التركيبة**: القراءة بتجدول `setLayout("four")`
     بس ما بتطبّقها فوراً، وبعدها تأثيرا الحفظ بينفّذوا و`hydrated` صار
     `true` بينما `layout` لسا القيمة الافتراضية — فبيكتبوا `"single"` فوق
     `"four"` المحفوظ.
     مقيس بالتشغيل: بدّلت لأربعة شارتات، عملت تحديث، رجع شارت واحد
     والمفتاح بالتخزين صار `"single"`.

     رفع الحارس بتأثير **مصرَّح بعد** تأثيري الحفظ بيصلحها: على التركيبة
     الأولى الحفظ بيتخطّى (الحارس لسا `false`)، وبعدها بيرتفع؛ ولما تنطبّق
     القيمة المقروءة بتصير تركيبة تانية فبيتحفظ الصح.
     ═══════════════════════════════════════════════════════════════════════ */
  useEffect(() => { hydrated.current = true; }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     الحد حسب عرض **الحاوية** — مش نافذة المتصفّح.
     -----------------------------------------------------------------------
     🔴 مقيس بالتشغيل: التخطيط `cols2` والعرض ٩٠٤ بكسل، ومع هيك بترسم
     **خلية وحدة**. السبب: القياس كان بينعمل مرة عند التركيب على
     `window.innerWidth`؛ ولو كانت اللوحة لسا ما استقرّت وقتها بيطلع الحد
     ١، وما في حدث `resize` بعدها ليصحّحه — فبيعلق على شارت واحد بلا سبب
     ظاهر للمستخدم.

     `ResizeObserver` بيقيس **الحاوية** وبينده مع كل تغيّر، فبيمسك الاستقرار
     المتأخّر — وكمان تغيّر عرض اللوحة (فتح/قفل الشريط الجانبي) وهو ما
     بيطلق `resize` على النافذة أصلاً.
     ═══════════════════════════════════════════════════════════════════════ */
  const rootRef = useRef(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = (w) => setMaxPanes(w < 900 ? 1 : w < 1400 ? 2 : 4);
    const measure = () => apply(el.clientWidth || window.innerWidth);
    measure();
    /* ⚠️ **مصدران للقياس عمداً.** `ResizeObserver` بيمسك تغيّر الحاوية اللي
       ما بيطلق حدث نافذة (فتح/قفل الشريط الجانبي)، بس تسليمه مربوط بدورة
       الرسم — بصفحة ما بترسم (تبويب بالخلفية، أو لوحة معاينة مش معروضة)
       ما بينده أبداً، ولا حتى النداء الأولي. مقيس: راقبت العنصر بمراقب
       جديد وما وصل ولا نداء بـ٩٠٠ms، والحاوية كانت فعلاً ٨١٠px.
       فلو اعتمدنا عليه لحاله، تصغير الشاشة ممكن يضل يعرض أربع شارتات على
       عرض ما بيتحمّل وحدة. حدث النافذة بيغطّي الحالة الشائعة. */
    window.addEventListener("resize", measure);
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect?.width;
        if (w) apply(w);
      });
      ro.observe(el);
    }
    return () => { window.removeEventListener("resize", measure); ro?.disconnect(); };
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     ارتفاع مساحة العمل — لازم ينقاس، ما بينورث.
     -----------------------------------------------------------------------
     `AppShell` بيلفّ الصفحات بـ`<div className="animate-fade-in">` وهاد
     ارتفاعه تلقائي، فـ`height:100%` هون بينحل لـ`auto` والشبكة بتتمدّد
     بطول محتواها بدل ما تملا الشاشة.

     ⚠️ **ما لمست `AppShell`** — كل صفحات المنصّة بتمرق منه، وتغيير ارتفاعه
     بيمسّها كلها. القياس هون محلي ومحصور بهالصفحة.

     الارتفاع = من أعلى مساحة العمل لآخر النافذة. بينقاس بعد كل رسم لأن
     أعلاها بيتحرّك مع الهيدر والشريط العلوي.
     ═══════════════════════════════════════════════════════════════════════ */
  const [fitH, setFitH] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      setFitH(Math.max(360, Math.round(window.innerHeight - top - 8)));
    };
    measure();
    window.addEventListener("resize", measure);
    /* تبديل التخطيط بيحرّك المحتوى بلا حدث نافذة — إطار واحد بيكفي ليستقر. */
    const t = requestAnimationFrame(measure);
    return () => { window.removeEventListener("resize", measure); cancelAnimationFrame(t); };
  }, [layout, maxPanes]);

  /* ⚠️ **الفتحات لازم تكون مراجع ثابتة الهوية.**
     أول تنفيذ استعمل `ref={(n) => setSlot("top", n)}` — دالة جديدة كل رندر،
     فReact بينده القديمة بـnull والجديدة بالعنصر مع **كل** رندر، والحالة
     بتتغيّر، فبيرندر من جديد: حلقة لا نهائية (React #185) بتجمّد الصفحة.
     `useCallback` بمصفوفة تبعيات فاضية بتثبّت الهوية. */
  const [slots, setSlots] = useState({ top: null, side: null, bottom: null });
  const setTopSlot = useCallback((node) => {
    setSlots((p) => (p.top === node ? p : { ...p, top: node }));
  }, []);
  const setSideSlot = useCallback((node) => {
    setSlots((p) => (p.side === node ? p : { ...p, side: node }));
  }, []);
  const setBottomSlot = useCallback((node) => {
    setSlots((p) => (p.bottom === node ? p : { ...p, bottom: node }));
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     المتحكّم المشترك بالقص — ناقل رقيق، مش محرّك تاني.
     -----------------------------------------------------------------------
     طلبه: «لا تنشئ Replay Engine منفصل لكل Chart… الأفضل أن يكون هناك
     Shared Replay Controller + Multiple Chart Views».

     المحرّك الحقيقي بيضل جوّا `ReplayClient` — نقله لبرّا يعني تفكيك ٩٠
     `useState` و٦٥ `useEffect`، وهو الـrefactor الكبير الممنوع. اللي انبنى
     هون هو **التحكّم** المشترك: اللوحة النشطة وحدها بتخطي وبتنشر وقتها،
     والباقي بتلحق. النتيجة اللي بيشوفها المستخدم وحدة — زر تشغيل واحد
     بيحرّك كل الشارتات — بلا ما نلمس المحرّك.

     ⚠️ الناقل بـ`useRef` مش بحالة: النشر بيصير مع كل شمعة أثناء التشغيل،
     ولو مرق بحالة كان كل خطوة بترندر مساحة العمل كلها بشارتاتها.
     ═══════════════════════════════════════════════════════════════════════ */
  const busRef = useRef(null);
  if (!busRef.current) {
    const subs = new Set();
    let last = null;
    busRef.current = {
      publish(t) { last = t; subs.forEach((fn) => { try { fn(t); } catch {} }); },
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
      peek() { return last; },
    };
  }

  const conf = LAYOUTS[layout] || LAYOUTS.single;
  const paneCount = Math.min(conf.panes, maxPanes);
  const multi = paneCount > 1;
  const ids = PANE_IDS.slice(0, paneCount);

  /* ═══════════════════════════════════════════════════════════════════════
     اللوحة اللي انفتحت مرة **بتضل مركّبة** — حتى لما التخطيط يصغّر.
     -----------------------------------------------------------------------
     طلبه: «تغيير التخطيط يجب ألا يفقد الرسومات أو موضع الـReplay أو الرمز
     أو الفريم»، و«لا تعمل إعادة إنشاء لكل الـchart instances عند تغيير
     التخطيط».

     الرسومات بـ`useRef` جوّا كل نسخة وما بتنحفظ بأي مخزن — فتفكيك اللوحة
     بيمسحها نهائياً. أربعة → اتنين → أربعة كان بيرجّع C وD **فاضيتين**.
     فبدل التفكيك بنخفيها بـ`display:none`: النسخة بتضل، والشارت ما
     بينبنى من جديد، والرسومات ونقطة القص بمكانهن.

     ⚠️ **ما منركّب الأربعة سلفاً.** التركيب بيجيب شموع وبيبني شارت، فأربع
     نسخ على شارت واحد = أربع أضعاف الشغل بلا ما يطلبها المستخدم. المجموعة
     بتكبر بس لما يفتح تخطيطاً فعلاً — وما بتصغر.

     ⚠️ اللوحة المخفية `clientHeight` تبعها صفر فبتقع على أرضية الارتفاع؛
     ومراقب الحجم بيصحّحها لما ترجع تبان. */
  const [everShown, setEverShown] = useState(() => new Set(["main"]));
  useEffect(() => {
    setEverShown((prev) => {
      if (ids.every((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const rendered = PANE_IDS.filter((id) => everShown.has(id));
  /* اللوحة النشطة لازم تكون موجودة فعلاً — بعد التصغير ممكن تختفي. */
  const active = ids.includes(activePane) ? activePane : "main";

  const menuRef = useRef(null);
  /* ⚠️ **زر الفتح لازم ينستثنى من مستمع الإغلاق.**
     المستمع على `pointerdown`، وهو بينطلق **قبل** `click`. فضغطة الزر كانت
     تسكّر القائمة (لأنه برّا `menuRef`) وبعدها `click` بيبدّل الحالة —
     فالنتيجة إنها ما بتفتح أبداً. مقيس بالفحص المحلي: ضغطتان متتاليتان
     وما ظهرت ولا مرة. */
  const btnRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex", flexDirection: "column", minHeight: 0, position: "relative",
        /* ⚠️ بالوضع المفرد بيضل `100%` بالضبط زي ما كان — صفر تغيير بالسلوك
           القديم. الارتفاع المقيس بينطبّق **بس** لما تنفتح شبكة. */
        height: multi && fitH ? fitH : "100%",
      }}
    >
      {/* شريط مشترك: اللوحة النشطة بتنقل شريطها لهون بـcreatePortal.
          بالوضع المفرد بيضل فاضياً والشريط بينرسم جوّا الشارت زي ما كان. */}
      {/* ⚠️ الفتحة بترسم **بس** بوضع الشارتات المتعددة. بالوضع المفرد الشريط
          بيضل جوّا الشارت زي ما كان، والفتحة الفاضية كانت بتاخد صفاً كامل
          وبتزحّ الشارت لتحت — بان بالفحص المحلي. */}
      {/* صف نحيف: الزر ببدايته (يمين بالـRTL)، والشريط المشترك بيملا الباقي.
          ⚠️ جرّبت أخلّي الزر طبقة مطلقة فوق الشريط — بيغطّي أزراره. والصف
          النحيف أوضح، وبالوضع المفرد بياخد ارتفاع الزر وبس. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: multi ? 4 : 0 }}>
        <button
          type="button"
          ref={btnRef}
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
        {/* ⚠️ الفتحة بترسم **بس** بوضع الشارتات المتعددة — بالوضع المفرد
            الشريط بيضل جوّا الشارت زي ما كان بالضبط. */}
        {multi && <div ref={setTopSlot} style={{ flex: 1, minWidth: 0 }} />}
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
            {/* ⚠️ **المطفيان مطفيان لأنهما ما انبنوا — مش لأنهما اختيار.**
                الوقت وحده موصول بالمحرّك. مربّع بينضغط وما بيعمل شي أسوأ من
                مربّع مش موجود: بيخلّي المستخدم يظن إنه شغّل مزامنة وهي مطفية.
                فبيضلّوا ظاهرين (عشان يبان إنهم قادمون) ومعطَّلين بوضوح. */}
            {[
              ["time", "الوقت ونقطة القص", true],
              ["crosshair", "المؤشر", false],
              ["zoom", "الزوم والتحريك", false],
            ].map(([k, label, ready]) => (
              <label
                key={k}
                title={ready ? label : "لسا ما انبنت"}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "0.25rem 0",
                  cursor: ready ? "pointer" : "not-allowed", fontSize: 12,
                  color: ready ? "#A79FC4" : "#4A4363",
                }}
              >
                <input
                  type="checkbox"
                  disabled={!ready}
                  checked={ready && !!sync[k]}
                  onChange={(e) => setSync((p) => ({ ...p, [k]: e.target.checked }))}
                  style={{ accentColor: "#6D4AFF", width: 14, height: 14, cursor: ready ? "pointer" : "not-allowed" }}
                />
                {label}
                {!ready && <span style={{ fontSize: 10.5, color: "#4A4363" }}>· قريباً</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          الهيكل المشترك: شريط علوي واحد · عمود أدوات واحد · شريط سفلي واحد.
          ---------------------------------------------------------------------
          من صورته الثانية (ملء الشاشة ٢×٢): الشبكة بالنص، عمود الأدوات
          على الشمال، والشريط السفلي تحتها — **نسخة وحدة من كل واحد** مش
          نسخة لكل شارت. اللي بيضل لكل شارت: ترويسته (رمز · فريم · OHLC).

          ⚠️ الترتيب بالـDOM (الشبكة أولاً ثم العمود) **مقصود**: الصفحة RTL
          فأول عنصر بينحط يمين — وهيك العمود بيستقر شمال بلا ما نقلب اتجاه
          أي نص عربي جوّاه. نفس الحيلة المستعملة جوّا `ReplayClient`.
          ═════════════════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0, gap: multi ? 6 : 0 }}>
      <div
        style={{
          flex: 1, minWidth: 0, minHeight: 0, display: "grid", gap: multi ? 6 : 0,
          gridTemplateColumns: paneCount === 1 ? "1fr" : conf.cols,
          gridTemplateRows: paneCount === 1 ? "1fr" : conf.rows,
        }}
      >
        {rendered.map((id) => {
          const i = ids.indexOf(id);
          const shown = i !== -1;
          const isActive = shown && id === active;
          /* تلات شارتات: الأول بياخد العمود كامل. */
          const span = shown && conf.panes === 3 && i === 0 ? { gridRow: "1 / span 2" } : null;
          return (
            <div
              key={id}
              style={{
                minWidth: 0, minHeight: 0, flexDirection: "column",
                position: "relative", borderRadius: 4, ...span,
                /* مخفية مش مفكوكة — شوف شرح `everShown` فوق. */
                display: shown ? "flex" : "none",
                /* ⚠️ `outline` مش `border`: الحدّ بيغيّر مقاس الصندوق فبيقفز
                   الشارت كل ما تتبدّل اللوحة النشطة. */
                outline: multi && shown ? `1px solid ${isActive ? "#6D4AFF" : "#1C1630"}` : "none",
                outlineOffset: -1,
                transition: "outline-color 0.12s ease",
              }}
            >
              <ReplayClient
                userId={userId}
                paneId={id}
                /* اللوحات الإضافية بتضل بوضع «املا الخليّة» حتى وهي مخفية —
                   وإلا كل رجوع لشارت واحد بيعيد قياسهن على النافذة بلا فايدة. */
                fillContainer={multi || id !== "main"}
                chromeSlots={multi ? slots : null}
                chromeActive={isActive}
                onActivate={multi ? () => setActivePane(id) : null}
                syncBus={busRef.current}
                /* ⚠️ المزامنة **بس** لما يكون في أكتر من لوحة معروضة. بشارت
                   واحد ما في مع مين تتزامن، وتشغيلها بيخلّي اللوحات المخفية
                   تلحق موضعاً هي مش معروضة أصلاً. */
                syncTime={multi && sync.on && sync.time && shown}
              />
            </div>
          );
        })}
      </div>
        {/* عمود الأدوات المشترك — بيرسم بس بالوضع المتعدّد. عرضه بيجي من
            الشريط نفسه (٥٢px)، فالفتحة بتتمدّد على ارتفاع الصف وبس. */}
        {multi && <div ref={setSideSlot} style={{ flex: "0 0 auto", display: "flex", minHeight: 0 }} />}
      </div>

      {/* الشريط السفلي المشترك — نفس المنطق: نسخة وحدة لكل مساحة العمل. */}
      {multi && <div ref={setBottomSlot} />}
    </div>
  );
}
