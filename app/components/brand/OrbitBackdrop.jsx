/* ============================================================================
   OrbitBackdrop — الشعار مكبَّراً كخلفية قسم البطل.
   ----------------------------------------------------------------------------
   قراره (٢٠٢٦-٠٩-٠١): «بدي إشي كبير يغطي مساحة كبيرة من الخلفية»، وبعدها
   اختار «الشعار هو المنظومة».

   **الشعار مش موجود بالتصميم — هو التصميم.** الـQ بـ`Logo.jsx` مبني أصلاً
   بلغة مدارية (حلقة · نواة · قوس مائل · ذيل)، فبنكبّره **×١٠.٩** بدل ما
   نلزقه:

       حلقة الـQ   `r=17.5` → `r=191`   صارت المدار الرئيسي
       النواة      `r=5`    → `r=56`    صارت الكرة
       الذيل       خط قصير  → شعاع ضوء
       القوس المائل `-28°`   → حزام حول الكرة

   المعامل مشتق مش مخترع: `191 ÷ 17.5 = 10.9`. أي تغيير بالشعار لازم يتبعه
   تعديل هون بنفس النسبة، وإلا صار شكلين مختلفين لنفس العلامة.

   ⚠️ **النجوم والشهب ما انشالوا** — قراره الصريح: «ما بدنا نتخلّى عن النجوم
   والشهب». `Starfield` بيضل الطبقة الأعمق، وهاد بينرسم فوقه. الاتنين
   `pointer-events-none` فما بيمسّوا أي تفاعل.

   ⚠️ **الجسم على اليسار.** الصفحة RTL فنص البطل بيقعد على اليمين — وتدرّج
   الحماية بيخفت لجهة النص، وإلا مرقت المدارات تحت الكلام وصعّبت القراءة.

   ⚠️ **SVG مش صورة**: بيتمدّد لأي عرض بلا تهبيش، ووزنه بالكيلوبايتات، وما
   بيحتاج طلب شبكة. والحركة بـSMIL — بتتوقف مع `prefers-reduced-motion` عبر
   قاعدة عامة بـ`globals.css`.
   ============================================================================ */

/* ═══════════════════════════════════════════════════════════════════════════
   `side` — أي جهة يقعد فيها الشعار.
   ---------------------------------------------------------------------------
   🔴 **انكشف لما انفتحت الإنجليزية.** التخطيط كان مبنياً على RTL وبس: الشعار
   يسار والنص يمين. وأول ما انقلب `dir` لـ`ltr`، النص راح لليسار — **فوق
   الشعار بالضبط** — وصار العنوان يمرق فوق المدارات.

   ⚠️ **والحل مش انعكاس بالـCSS.** `scale-x-[-1]` بيقلب المشهد كله وفيه
   **الـQ**: ذيلها بيصير طالعاً لأسفل اليسار بدل اليمين، يعني حرف مقلوب —
   وهاد كسر للعلامة مش تكيّف تخطيط. الحلقة دائرة متماثلة فما بتشتكي، بس
   الذيل هو اللي بيعرّف الحرف.

   فاللي بينتقل **موضع** المجموعة و**جهة تدرّج الحماية**، والرسمة نفسها ما
   بتتغيّر ولا نقطة. الشعار بيضل مقروءاً صح بالحالتين.

   ⚠️ المدار الأوسع `rx=470 × 0.6 = 282` — فمركز `900` بيعطي مدى
   `618→1182` جوّا `viewBox` عرضه ١٢٠٠. ما بينقصّ.
   ═══════════════════════════════════════════════════════════════════════════ */
export default function OrbitBackdrop({ className = "", side = "start" }) {
  /* `start` = جهة بداية القراءة. بالعربي (RTL) البداية يمين فالشعار بيروح
     يسار؛ وبالإنجليزي بالعكس. المكوّن ما بيقرأ الاتجاه بنفسه — الصفحة
     بتمرّره، فبيضل قابلاً للاستعمال بأي سياق. */
  const onLeft = side === "start";
  const cx = onLeft ? 300 : 900;
  /* الحماية بتغطّي **جهة النص**: تعتيم كامل عند حافتها البعيدة، وشفاف عند
     الشعار — فالكلام بيقرا والمدارات بتضل تبان تحته. */
  const fade = onLeft
    ? { x: 560, x1: 1200, x2: 560 }
    : { x: 0, x1: 0, x2: 640 };

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          🔴 **كان `slice` — والرسمة بتنفجر على الشاشات الطويلة.**
          -------------------------------------------------------------------
          `slice` معناها «تمدّدي لتغطّي الصندوق واقتصّي الزايد». نسبة الرسمة
          `1200/440 = 2.73`، فلمّا يكون القسم طويلاً (نافذة أضيق أو تكبير
          بالمتصفّح) بتتحجّم على **الارتفاع** — مثال مقيس بلقطته: صندوق
          `1132×760` معناه تكبير `760/440 = 1.73×`، فالعرض بيصير `2073px`
          وثلثه بينقصّ. المدارات بتطلع برّا الإطار.
          بلاغه: «كثير كبير لدرجة المدارات عم تطلع من الإطار».

          `meet` بتحجّمها لتناسب **العرض** بلا قص — فحجم الشعار صار مربوطاً
          بعرض القسم زي ما هو متوقّع، وأي فراغ عمودي بيملاه حقل النجوم تحته.
          ═══════════════════════════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 1200 440"
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <defs>
          {/* تدرّج الشعار نفسه — نفس الأوقاف بـ`Logo.jsx` */}
          <linearGradient id="obQ" x1="60" y1="20" x2="620" y2="420" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C4DFF" />
            <stop offset="0.45" stopColor="#9F6CFF" />
            <stop offset="1" stopColor="#22D3EE" />
          </linearGradient>
          {/* نسخة أخفت للمدارات البعيدة */}
          <linearGradient id="obQd" x1="60" y1="20" x2="620" y2="420" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C4DFF" stopOpacity="0.25" />
            <stop offset="0.5" stopColor="#C4B0FF" stopOpacity="0.7" />
            <stop offset="1" stopColor="#22D3EE" stopOpacity="0.3" />
          </linearGradient>
          {/* الكرة: إضاءة من أعلى اليسار وظل بيعمّق للحافة */}
          <radialGradient id="obSp" cx="0.38" cy="0.3" r="0.78">
            <stop offset="0" stopColor="#2a1f4d" />
            <stop offset="0.45" stopColor="#150e2c" />
            <stop offset="0.8" stopColor="#0a0614" />
            <stop offset="1" stopColor="#050308" />
          </radialGradient>
          {/* حافة الغلاف الجوي — هي اللي بتخلّي الكرة تبان مجسّمة */}
          <radialGradient id="obRim" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.88" stopColor="#7C4DFF" stopOpacity="0" />
            <stop offset="0.96" stopColor="#D8CBFF" stopOpacity="0.9" />
            <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="obHl" cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#7C4DFF" stopOpacity="0.17" />
            <stop offset="1" stopColor="#7C4DFF" stopOpacity="0" />
          </radialGradient>
          {/* القمر معدني: لمعة أعلى اليسار وظل أسفل اليمين */}
          <radialGradient id="obMn" cx="0.33" cy="0.28" r="0.8">
            <stop offset="0" stopColor="#F2ECFF" />
            <stop offset="0.35" stopColor="#9F6CFF" />
            <stop offset="0.75" stopColor="#3C2090" />
            <stop offset="1" stopColor="#150A33" />
          </radialGradient>
          <clipPath id="obCl"><circle cx="330" cy="220" r="56" /></clipPath>
          {/* حماية النص: بتخفت لجهة الشعار، وبتعتّم عند جهة الكلام. */}
          <linearGradient id="obFade" x1={fade.x1} y1="0" x2={fade.x2} y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0a0614" stopOpacity="0.93" />
            <stop offset="1" stopColor="#0a0614" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ═══════════════════════════════════════════════════════════════════
            **معامل تحجيم واحد للتصميم كله.**
            -------------------------------------------------------------------
            بلاغه بعد أول تركيب: «لسّاته كثير كبير». وبدل ما أعدّل ١٥ رقماً
            كل مرة (وأخاطر إني أكسر النسب بين الحلقة والذيل والنواة — وهي
            نسب الشعار نفسه)، التحجيم بينعمل من مكان **واحد** حوالين مركز
            الشعار. النسب الداخلية بتضل مقفولة على الشعار، والحجم الظاهر
            بينضبط برقم واحد.

            `0.6` = ٦٠٪ من الحجم الأول. والمركز انزاح من `(330,220)` لـ
            `(300,215)` عشان يضل الشعار قريب من الحافة اليسرى فيقرأ كأنه
            ممتد برّا الإطار بدل ما يبان جسماً صغيراً طايفاً بالنص.
            ═══════════════════════════════════════════════════════════════════ */}
        <g transform={`translate(${cx} 215) scale(0.6) translate(-330 -220)`}>

        {/* ⚠️ الهالة خفّت كمان — كانت `0.3` وبتغسل النجوم بنص اليسار. */}
        <circle cx="330" cy="220" r="300" fill="url(#obHl)">
          <animate attributeName="r" values="280;330;280" dur="7s" repeatCount="indefinite" />
        </circle>

        {/* مدارات إضافية بتملا عرض القسم — بتلف كلها ببطء شديد */}
        <g>
          <animateTransform attributeName="transform" type="rotate"
            from="0 330 220" to="360 330 220" dur="200s" repeatCount="indefinite" />
          <g fill="none" stroke="url(#obQd)">
            <g transform="rotate(-30 330 220)"><ellipse cx="330" cy="220" rx="470" ry="138" strokeWidth="1.2" /></g>
            <g transform="rotate(12 330 220)"><ellipse cx="330" cy="220" rx="320" ry="94" strokeWidth="1" /></g>
          </g>
          {/* تدريجات قياس على المدار الأوسع — لغة أداة قياس، بتناسب منصّة تداول */}
          <g transform="rotate(-30 330 220)">
            <ellipse cx="330" cy="220" rx="484" ry="142" fill="none"
              stroke="#C4B0FF" strokeWidth="7" strokeOpacity="0.14" strokeDasharray="2 13" />
          </g>
          <g transform="rotate(-30 330 220)">
            <circle r="10" fill="url(#obMn)" style={{ filter: "drop-shadow(0 0 12px rgba(124,77,255,.8))" }}>
              <animateMotion dur="32s" repeatCount="indefinite"
                path="M -140 220 a 470 138 0 1 0 940 0 a 470 138 0 1 0 -940 0" />
            </circle>
          </g>
          <g transform="rotate(12 330 220)">
            <circle r="7" fill="url(#obMn)" style={{ filter: "drop-shadow(0 0 10px rgba(34,211,238,.7))" }}>
              <animateMotion dur="19s" repeatCount="indefinite"
                path="M 10 220 a 320 94 0 1 0 640 0 a 320 94 0 1 0 -640 0" />
            </circle>
          </g>
        </g>

        {/* ═══ الشعار مكبَّراً ═══
            ⚠️ **السماكات خفّت بعد المعاينة.** أول تنفيذ كان بحلقة `33` وذيل
            `37` بشفافية شبه كاملة — والنتيجة إنّ الشعار صار **يزاحم العنوان**
            بدل ما يكون خلفيته، وحجب النجوم والشهب تحته بالجهة اليسرى.
            بلاغه: «نسّقها للأفضل».
            القاعدة: الخلفية بتُقرأ **بالشكل** مش بالسطوع — فالسماكة نزلت
            للنص تقريباً والشفافية للنص، والشكل ضل هو هو. */}
        {/* ذيل الـQ — النقطتان مشتقّتان من `M29 29 L41.5 41.5` بالشعار */}
        <path d="M384 274 L521 411" stroke="url(#obQ)" strokeWidth="17" strokeLinecap="round" opacity="0.5" />
        <path d="M384 274 L521 411" stroke="#E9E0FF" strokeWidth="3" strokeLinecap="round" opacity="0.22" />
        {/* حلقة الـQ — المدار الرئيسي */}
        <circle cx="330" cy="220" r="191" fill="none" stroke="url(#obQ)" strokeWidth="15" opacity="0.46" />
        <circle cx="330" cy="220" r="191" fill="none" stroke="#E9E0FF" strokeWidth="1.2" opacity="0.22" />
        {/* القوس المائل من الشعار — نفس زاوية `-28°` */}
        <ellipse cx="330" cy="220" rx="191" ry="71" fill="none" stroke="url(#obQ)" strokeWidth="7"
          opacity="0.32" transform="rotate(-28 330 220)" />
        {/* قمر بيركب على حلقة الشعار نفسها */}
        <circle r="12" fill="url(#obMn)" style={{ filter: "drop-shadow(0 0 16px rgba(124,77,255,.95))" }}>
          <animateMotion dur="26s" repeatCount="indefinite"
            path="M 139 220 a 191 191 0 1 0 382 0 a 191 191 0 1 0 -382 0" />
        </circle>

        {/* النواة = الكرة */}
        <circle cx="330" cy="220" r="56" fill="url(#obSp)" />
        {/* عروق مضيئة — بتكسر استواء السطح وبتخلّيه يقرأ كرخام مش دايرة */}
        <g clipPath="url(#obCl)" stroke="#C4B0FF" fill="none" strokeLinecap="round">
          <path d="M281 194 C300 210 307 235 297 267" strokeWidth="1.3" opacity="0.5" />
          <path d="M307 235 C325 230 341 238 355 230" strokeWidth="1.2" opacity="0.55" stroke="#8FEEFF" />
          <path d="M355 230 C365 218 362 202 352 191" strokeWidth="1" opacity="0.45" />
          <path d="M297 267 C314 260 326 248 328 235" strokeWidth="0.9" opacity="0.35" />
        </g>
        <circle cx="330" cy="220" r="56" fill="url(#obRim)">
          <animate attributeName="opacity" values="0.85;1;0.85" dur="5s" repeatCount="indefinite" />
        </circle>
        <circle cx="330" cy="220" r="72" fill="none" stroke="#7C4DFF" strokeWidth="0.9">
          <animate attributeName="r" values="66;96;66" dur="5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="5s" repeatCount="indefinite" />
        </circle>

        </g>

        {/* ⚠️ حماية النص **برّا** مجموعة التحجيم — لازم تضل مغطّية جهة النص
            بالكامل مهما تغيّر حجم الشعار. */}
        <rect x={fade.x} y="0" width="640" height="440" fill="url(#obFade)" />
      </svg>
    </div>
  );
}
