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
/* v2: الافتراضي رجع **شارت واحد** بقراره — «الوضع الافتراضي المفروض يكون
   شارت واحد فاتح وأنا إذا بدي أزيد بزيد». المفتاح انبدّل عشان أي تخطيط
   متعدّد محفوظ من قبل (منه تخطيطات فحصي) ما يفتح لوحتين بوجهه من جديد.
   الاختيار لسا بينحفظ — بس نقطة البداية صارت وحدة. */
const LAYOUT_KEY = "replayLayout_v2";
/* v5: **المؤشر ونافذة الوقت مشغّلين افتراضياً** — من صورة تريدنغ فيو اللي
   بعتها: الشارتان بنفس نافذة الوقت والشموع مصطفّة ومحور زمن واحد.
   بلا مزامنة النافذة، كل لوحة بتعرض مدى مختلف (قِسته: ٠٦:٠٠→١٥:٠٠ فوق
   مقابل ٠٣:٠٠→١٢:٠٠ تحت) — فنفس العمود بيعطي وقتين مختلفين، وهاد اللي
   خلّى المؤشر يبان «مش على نفس اللحظة».
   ⚠️ اللحظة العابرة وقت التحميل (اللي طلّعت الزوم متطرّفاً) انسدّت بحارس
   `loadingRef` عند النشر، مش بإطفاء الميزة.
   اللي بينحفظ هون أربع قيم منطقية وبس. */
/* v7: **المؤشر ونافذة الوقت مشغّلين** — «رجع مزامنة النافذة، بدي الشموع
   تكون مصطفّة». الأعراض اللي ظهرت بجولة v5 (ريفرش كل ٥ ثواني · القفز لآخر
   شمعة · نصف اللوحة فاضي) كانت تلات أسباب منفصلة انسدّت عند مصادرها:
   نشرة الاستقرار صارت على الحافة · تغيّرات النطاق الناتجة عن وصول شمعة
   ما بتنتشر · ونافذة القائدة بتنقصّ على مدى بيانات التابعة قبل ما تنطبّق. */
const SYNC_KEY = "replaySync_v8";

/* التخطيطات: `panes` عدد اللوحات · `css` شبكة CSS.
   ⚠️ الأسماء ثابتة لأنها بتنحفظ بالمتصفح — تغييرها بيفقد تخطيط المستخدم. */
const LAYOUTS = {
  single: { panes: 1, cols2n: 1, label: "شارت واحد", Icon: Square, cols: "1fr", rows: "1fr" },
  cols2: { panes: 2, cols2n: 2, label: "شارتين أفقي", Icon: Columns2, cols: "1fr 1fr", rows: "1fr" },
  rows2: { panes: 2, cols2n: 1, label: "شارتين عمودي", Icon: Rows2, cols: "1fr", rows: "1fr 1fr" },
  three: { panes: 3, cols2n: 2, label: "تلاتة شارتات", Icon: LayoutGrid, cols: "1fr 1fr", rows: "1fr 1fr" },
  four: { panes: 4, cols2n: 2, label: "أربعة شارتات", Icon: Grid2x2, cols: "1fr 1fr", rows: "1fr 1fr" },
};
/* ═══════════════════════════════════════════════════════════════════════════
   🔴 **الحدّ كان بيقيس العرض الكلي بدرجات ثابتة — مش عرض العمود.**
   ---------------------------------------------------------------------------
   كان: `w < 900 ? 1 : w < 1400 ? 2 : 4`. فنافذة ١٢١٠ بكسل (شاشة مع DevTools
   مفتوحة مثلاً) بتقع تحت ١٤٠٠ فبينعطّل خيارا التلاتة والأربعة — مع إنّ
   أربع لوحات هناك بتعطي عمودين بعرض **٦٠٥ بكسل** لكل وحدة، وهاد أوسع بكتير
   من الحدّ المقروء. بلاغه: «بكبس عليهم بس ما بتغيّروا الشارتات» — والفحص
   طلّع `disabled: true` على الاتنين.

   القاعدة المكتوبة أصلاً هي **عرض العمود** («عمود شارت أقل من ~٤٢٠ بكسل
   بيصير غير مقروء»)، وعدد الأعمدة بأربع لوحات **اتنان** مش أربعة. فالحدّ
   صار يطبّق القاعدة نفسها: بنقسم العرض على أعمدة التخطيط، ولو طلع العمود
   ≥ ٤٢٠ بنسمح فيه. والصفوف ما بتدخل — ارتفاع الشارت بينضغط بلا ما يصير
   غير مقروء، بعكس العرض.
   ═══════════════════════════════════════════════════════════════════════════ */
const MIN_COL_PX = 420;
/* ═══════════════════════════════════════════════════════════════════════════
   🔴 **إخفاء محور الزمن بيكسر مقياس رسم اللوحة — مقيس.**
   ---------------------------------------------------------------------------
   كانت الفكرة «مؤشر زمن واحد بآخر صف زي تريدنغ فيو» عبر
   `AXIS_PANES = { …, three: [0,2], four: [2,3] }`.

   بس `timeScale: { visible: false }` بيخلّي `timeScale().width()` يرجّع
   **صفر**، والمكتبة بتشتق منه `barSpacing = العرض ÷ عدد الشموع`. فاللوحة
   بتستقبل النافذة وبتخزّنها صح، وبترسم بتباعد **قديم**.

   مقيس على أربع لوحات (نفس الرمز والفريم، المزامنة شغّالة):
       main  axis:false  tsWidth 0    logical 20225.86→20342
       B     axis:false  tsWidth 0    logical 20225.86→20342
       C     axis:true   tsWidth 820  logical 20225.86→20342
       D     axis:true   tsWidth 820  logical 20225.86→20342
   نفس النطاق بالأربعة، ومقياسان مختلفان على الشاشة. بلاغه: «تلاتة وأربعة
   فيهن مشكلة، الباقي تمام» — و«شارتين أفقي» هو الوحيد اللي محوره ظاهر
   باللوحتين.

   ⚠️ **والحل الأول كان إظهار المحور بكل لوحة — وانرفض.** بلاغه: «ليه في
   مؤشرين زمنيات؟ بدي شريط زمني واحد وبس». فالمحور رجع لآخر لوحة بالعمود،
   بس **الإخفاء صار بالقص مش بالإطفاء**: الشارت بينرسم محوره دايماً (فالعرض
   بيضل صحيحاً)، وارتفاعه بيزيد بمقدار المحور فيوقع تحت حافة الحاوية
   وينقصّ. شوف `TIME_AXIS_H` بـ`ReplayClient`.
   ⚠️ ما انلمس شي بالمزامنة ولا بحساب الشموع — العلّة كانت بعرض السلّم وبس.
   ═══════════════════════════════════════════════════════════════════════════ */
const AXIS_PANES = { single: [0], cols2: [0, 1], rows2: [1], three: [0, 2], four: [2, 3] };
const PANE_IDS = ["main", "B", "C", "D"];

export default function ReplayWorkspace({ userId }) {
  const [layout, setLayout] = useState("single");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePane, setActivePane] = useState("main");
  const [sync, setSync] = useState({ on: true, time: true, crosshair: true, zoom: true, timeframe: true });
  /* عرض مساحة العمل المقيس. القرار بيتحسب منه لكل تخطيط حسب أعمدته —
     شوف `MIN_COL_PX` فوق. طلبه: «على الشاشات الصغيرة لا تحاول ضغط ٤ شارتات».
     ⚠️ القيمة الأولية كبيرة عمداً حتى ما تنعطّل الخيارات قبل أول قياس. */
  const [availWidth, setAvailWidth] = useState(9999);
  const layoutAllowed = useCallback(
    (key) => availWidth / ((LAYOUTS[key] || LAYOUTS.single).cols2n || 1) >= MIN_COL_PX,
    [availWidth]
  );
  /* أكبر عدد لوحات مسموح بالتخطيطات المتاحة — للقصّ عند التصغير. */
  const maxPanes = Object.entries(LAYOUTS)
    .filter(([k]) => layoutAllowed(k))
    .reduce((m, [, c]) => Math.max(m, c.panes), 1);

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
    /* العرض المتاح بيتخزّن كما هو، والقرار لكل تخطيط بيتحسب من أعمدته. */
    const apply = (w) => setAvailWidth(w || 0);
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
  /* ⚠️ **بالشاشة الكاملة ما منستعمل الارتفاع المقيس إطلاقاً.**
     العنصر المفتوح كتلته الحاوية هي الشاشة نفسها، فـ`height:100%` بتعطي
     ارتفاعها بالضبط وبلحظة الانتقال — بينما الرقم المقيس بيتأخّر إطار أو
     اتنين (`innerHeight` و`rect.top` بيرجّعوا قيم ما قبل الانتقال)، فبتطلع
     شبكة بمقاس النافذة القديمة جوّا شاشة أكبر مع فراغ أسود حواليها. */
  const [wsFullscreen, setWsFullscreen] = useState(false);

  /* ═══════════════════════════════════════════════════════════════════════
     🔴 **زر الشاشة الكاملة ما كان بيعمل شي عنده — والسبب برّا كودنا.**
     -----------------------------------------------------------------------
     `requestFullscreen` بترفض بصمت لما تكون الصفحة جوّا `iframe` بلا
     `allow="fullscreen"` — وهاي حالة المتصفّح المدمج بالتطبيقات. فالزر
     بينضغط وما بيصير إشي وبلا أي خطأ ظاهر، وهاد بالضبط وصفه: «ما عم تكبس».

     الحل: وضع تكبير **بالـCSS** كبديل — `position:fixed; inset:0` بيملا
     النافذة كلها بنفس النتيجة العملية (كل الشارتات ظاهرة، شريط واحد، بلا
     تمرير)، وبيشتغل بأي متصفّح لأنه ما بيحتاج أي إذن.

     الترتيب: منجرّب الأصلية أول (بتعطي شاشة كاملة حقيقية بلا شريط المتصفّح)،
     وبس لما تنرفض أو تكون ممنوعة منوقع على البديل.
     ═══════════════════════════════════════════════════════════════════════ */
  const [maximized, setMaximized] = useState(false);
  const toggleMaximized = useCallback(() => setMaximized((v) => !v), []);

  /* ═══════════════════════════════════════════════════════════════════════════
     تكبير لوحة وحدة بالدبل كليك.
     ---------------------------------------------------------------------------
     قراره: «دبل كليك على شارت بيعمل إله فل سكرين، ودبل كليك تاني بيرجّعه».

     ⚠️ مش `maximized` القائم — هداك بيكبّر **الشبكة كلها** (الشريط المشترك
     جوّاها) وبيضل كل الشارتات ظاهرة. هون المطلوب شارت واحد ياخد المساحة.

     ⚠️ والمكبَّرة **ما بتنفكّ ولا وحدة معها**: نفس آلية `everShown` — الباقي
     بينخفي بـ`display:none` وبس، فالرسومات ونقطة القص والزوم بتضل مكانها لما
     ترجع. وهاد كمان بيخلّي الرجعة فورية بلا إعادة تحميل.
     ═══════════════════════════════════════════════════════════════════════════ */
  const [soloPane, setSoloPane] = useState(null);
  const toggleSolo = useCallback((id) => setSoloPane((p) => (p === id ? null : id)), []);
  useEffect(() => {
    if (!soloPane) return;
    const onKey = (e) => { if (e.key === "Escape") setSoloPane(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [soloPane]);
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e) => { if (e.key === "Escape") setMaximized(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      setFitH(Math.max(360, Math.round(window.innerHeight - top - 8)));
    };
    measure();
    window.addEventListener("resize", measure);
    /* ⚠️ دخول الشاشة الكاملة **ما بيطلق `resize`** بكل المتصفّحات، مع إنّ
       أعلى مساحة العمل بيصير صفر وارتفاع النافذة بيصير ارتفاع الشاشة. بلا
       هالمستمع بتضل الشبكة على مقاس النافذة القديم جوّا شاشة كاملة أكبر.
       والتأخير لأن القياس لحظة الحدث بيرجّع أبعاد ما قبل الانتقال. */
    const onFs = () => {
      setWsFullscreen(document.fullscreenElement === rootRef.current);
      measure(); setTimeout(measure, 60);
    };
    document.addEventListener("fullscreenchange", onFs);
    /* تبديل التخطيط بيحرّك المحتوى بلا حدث نافذة — إطار واحد بيكفي ليستقر. */
    const t = requestAnimationFrame(measure);
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("fullscreenchange", onFs);
      cancelAnimationFrame(t);
    };
  }, [layout, availWidth]);

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
    /* قنوات مسمّاة: `time` (نقطة القص) · `crosshair` · `zoom`. كل وحدة إلها
       مشتركيها وآخر قيمة فيها، فتشغيل وحدة ما بيوقظ التانيات. */
    const subs = new Map();
    const last = new Map();
    busRef.current = {
      publish(kind, payload) {
        last.set(kind, payload);
        const set = subs.get(kind);
        if (set) set.forEach((fn) => { try { fn(payload); } catch {} });
      },
      subscribe(kind, fn) {
        if (!subs.has(kind)) subs.set(kind, new Set());
        subs.get(kind).add(fn);
        return () => subs.get(kind)?.delete(fn);
      },
      peek(kind) { return last.get(kind); },
    };
  }

  const conf = LAYOUTS[layout] || LAYOUTS.single;
  /* التخطيط الحالي ما بيسعه العرض؟ منقصّ عدد لوحاته لأكبر عدد مسموح. */
  const paneCount = layoutAllowed(layout) ? conf.panes : Math.min(conf.panes, maxPanes);
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
  /* ونفس الشي للمكبَّرة: رجعنا لشارت واحد أو اختفت؟ منلغي التكبير حتى ما
     تعلق الشبكة على لوحة مش معروضة أصلاً. */
  useEffect(() => {
    if (soloPane && !ids.includes(soloPane)) setSoloPane(null);
  }, [soloPane, ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  /* اللوحة المكبَّرة فعلياً — بس بوضع الشبكة. */
  const solo = multi && soloPane && ids.includes(soloPane) ? soloPane : null;


  /* ⚠️ **زر الفتح لازم ينستثنى من مستمع الإغلاق.**
     المستمع على `pointerdown`، وهو بينطلق **قبل** `click`. فضغطة الزر كانت
     تسكّر القائمة وبعدها `click` بيبدّل الحالة — فالنتيجة إنها ما بتفتح
     أبداً. مقيس بالفحص المحلي: ضغطتان متتاليتان وما ظهرت ولا مرة.
     عشان هيك `data-layout-menu` على **الغلاف** — بيضم الزر والقائمة سوا. */

  /* زرّ التخطيط كعنصر — بينرسم جوّا شريط الشارت بدل صفّ لحاله.
     ⚠️ المقاس والستايل مطابقين لأزرار الشريط (٣٠ ارتفاع، زوايا ٣) حتى ما
     يبان غريباً بينهن. والقائمة **معه** مش بمساحة العمل — السبب تحت. */
  const layoutBtn = (
    <div data-layout-menu style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        title="تخطيط الشارتات"
        style={{
          display: "flex", alignItems: "center", gap: 5, height: 30,
          padding: "0 8px", borderRadius: 3, cursor: "pointer", flexShrink: 0,
          border: `1px solid ${menuOpen ? "#6D4AFF" : "transparent"}`,
          background: menuOpen ? "#1A1230" : "transparent",
          color: menuOpen ? "#C9BEFF" : "#A79FC4",
          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
        }}
        className="tv-btn"
      >
        <LayoutGrid size={15} strokeWidth={1.9} aria-hidden />
        تخطيط
      </button>
      {/* ⚠️ القائمة **جوّا** الزر مش بمساحة العمل: بالشاشة الكاملة العنصر
          المفتوح هو صندوق الشارت، وأي شقيق برّاه ما بينرسم أصلاً — فكانت
          تضوي وما بتطلع خيارات. بلاغه. */}
        {menuOpen && (
          <div
            style={{
              /* بالنسبة للزر نفسه هلق — تحته مباشرة.
                 ⚠️ `left` صريحة مش `insetInlineEnd`: شريط الشارت مثبَّت على
                 `direction: ltr`، فالمنطقية كانت تصير «يمين» والقائمة تمتد
                 لليسار من زر قريب من الحافة — مقيس `x = -109`، نصّها برّا
                 الشاشة. و`rtl` جوّاها عشان محتواها عربي. */
              position: "absolute", top: 34, left: 0, zIndex: 40, width: 232,
              direction: "rtl",
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
              /* القرار بعرض العمود مش بعدد اللوحات — شوف MIN_COL_PX. */
              const blocked = !layoutAllowed(key);
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
              {/* ✅ التلاتة موصولات بالمحرّك (٢٠٢٦-٠٨-٢٨، قراره: «شغل مزامنة
                  المؤشر والزوم»). كانوا اتنين منهن معطَّلين لأنهم ما كانوا
                  مبنيين — والمربّع اللي بينضغط وما بيعمل شي أسوأ من غيابه. */}
              {[
                ["timeframe", "الفريم"],
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
    </div>
  );
  /* ═══════════════════════════════════════════════════════════════════════════
     🔴 **الإغلاق بيتقرّر من الـDOM مش من مرجع محفوظ.**
     ---------------------------------------------------------------------------
     كان: `menuRef.current.contains(e.target)`. و`menuRef` مرجع **واحد**، بينما
     زرّ التخطيط بينرسم جوّا شريط الشارت — والشريط بينتقل بين ثلاث مواقع
     (سطري · بورتال للفتحة المشتركة · جوّا صندوق الشارت بالشاشة الكاملة). لو
     تصادف وانرسم بأكتر من مكان، المرجع بيمسك **آخر نسخة ركّبت**، فالكبسة على
     نسخة تانية بتطلع «برّا القائمة»:
         pointerdown → setMenuOpen(false) → القائمة بتتشال → حدث `click` ما
         بيوصل أصلاً لأن العنصر انحذف بينهن.
     والنتيجة بالضبط: القائمة بتسكّر وما بيصير إشي — «ما بيكبسوا».

     الحل: علامة `data-layout-menu` على غلاف الزر والقائمة، والفحص بـ`closest`
     — بيمشي على الشجرة الفعلية اللي انضغطت، فما بيهمّه كم نسخة موجودة ولا
     أيّها ركّبت آخر شي. */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      const t = e.target;
      if (t && typeof t.closest === "function" && t.closest("[data-layout-menu]")) return;
      setMenuOpen(false);
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
        height: (wsFullscreen || maximized) ? "100%" : (multi && fitH ? fitH : "100%"),
        /* العنصر المفتوح بالشاشة الكاملة بينرسم فوق خلفية سوداء من المتصفّح،
           وبلا لون خاص فيه بيبان الفراغ حواليه أسود مكسوراً عن هوية الأداة. */
        ...(wsFullscreen ? { background: "#0A0614", padding: 6 } : null),
        /* البديل: بيملا النافذة بلا أي إذن من المتصفّح. */
        ...(maximized ? { position: "fixed", inset: 0, zIndex: 60, background: "#0A0614", padding: 6 } : null),
      }}
    >
      {/* شريط مشترك: اللوحة النشطة بتنقل شريطها لهون بـcreatePortal.
          بالوضع المفرد بيضل فاضياً والشريط بينرسم جوّا الشارت زي ما كان. */}
      {/* ⚠️ الفتحة بترسم **بس** بوضع الشارتات المتعددة. بالوضع المفرد الشريط
          بيضل جوّا الشارت زي ما كان، والفتحة الفاضية كانت بتاخد صفاً كامل
          وبتزحّ الشارت لتحت — بان بالفحص المحلي. */}
      {/* ⚠️ **الزر ما عاد بصفّ لحاله.** كان صفاً نحيفاً فوق الشارت — بياكل
          ارتفاعاً، وبالشاشة الكاملة بيضل برّا العنصر المفتوح فما بتقدر
          تبدّل التخطيط. بلاغه على الاتنين. صار بينمرَّر لـ`ReplayClient`
          وبينرسم **جوّا شريط الشارت** (`layoutBtn` تحت)، فما بياخد ولا بكسل
          زيادة وبيروح مع الشارت للشاشة الكاملة.
          الفتحة المشتركة بتضل صفّها بوضع الشبكة وحده. */}
      {multi && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div ref={setTopSlot} style={{ flex: 1, minWidth: 0 }} />
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
          /* لوحة مكبَّرة = خليّة وحدة تاخد كل المساحة. */
          gridTemplateColumns: (paneCount === 1 || solo) ? "1fr" : conf.cols,
          gridTemplateRows: (paneCount === 1 || solo) ? "1fr" : conf.rows,
        }}
      >
        {rendered.map((id) => {
          const i = ids.indexOf(id);
          const shown = solo ? id === solo : i !== -1;
          const isActive = shown && (solo ? true : id === active);
          /* تلات شارتات: الأول بياخد العمود كامل — ما إلها معنى وقت التكبير. */
          const span = !solo && shown && conf.panes === 3 && i === 0 ? { gridRow: "1 / span 2" } : null;
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
                syncCrosshair={multi && sync.on && sync.crosshair && shown}
                syncZoom={multi && sync.on && sync.zoom && shown}
                /* الفريم مشترك دايماً بوضع الشبكة — مش مربوط بمربّعات القائمة. */
                syncTimeframe={multi && sync.on && sync.timeframe !== false && shown}
                /* المكبَّرة لازم تعرض محورها — ممكن تكون وحدة ما بتملكه بالشبكة. */
                /* محور زمن واحد للمنصّة — آخر لوحة بالعمود بس. الباقي محورهن
                   موجود للمكتبة (عشان المقياس) ومقصوص بصرياً. */
                showTimeAxis={!multi || solo === id || (!solo && (AXIS_PANES[layout] || [0]).includes(i))}
                /* ═══════════════════════════════════════════════════════════
                   الشاشة الكاملة بتاخد **مساحة العمل** بالحالتين.
                   -----------------------------------------------------------
                   لازم تكون الشبكة جوّا العنصر المفتوح: لو كانت على صندوق
                   الشارت الواحد، تبديل التخطيط بينفّذ فعلاً (مقيس: التخزين
                   `rows2 → four` و١٦ كانفس صاروا ٣٢) بس **ما بيبان** — لأنّ
                   اللوحات بتنرسم برّا العنصر المفتوح. بلاغه.

                   ⚠️ وما بتكلّف ارتفاعاً: صفّ زرّ التخطيط انشال، والزر صار
                   جوّا شريط الشارت (`layoutButton`) — فالجذر ما فيه إلا
                   الشبكة نفسها.
                   ═══════════════════════════════════════════════════════════ */
                fullscreenTargetRef={rootRef}
                /* الزر بينرسم جوّا شريط الشارت — بالمفرد بشريطه هو، وبالشبكة
                   بالشريط المشترك (مهيّأ من اللوحة النشطة، فنسخة وحدة). */
                layoutButton={layoutBtn}
                /* البديل لما يمنع المتصفّح الشاشة الكاملة الأصلية. */
                onMaximizeToggle={toggleMaximized}
                isMaximized={maximized}
                /* دبل كليك على الشارت بيكبّره لحاله ويرجّعه. */
                onSoloToggle={multi ? () => toggleSolo(id) : null}
                isSolo={solo === id}
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
