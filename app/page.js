"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  Dna,
  FileText,
  GraduationCap,
  LineChart,
  Radar,
  Radio,
  Repeat,
  Target,
  Users,
} from "lucide-react";
import Logo from "./components/brand/Logo";
import Starfield from "./components/brand/Starfield";
import OrbitBackdrop from "./components/brand/OrbitBackdrop";
import LanguageSwitcher from "./components/layout/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/* ============================================================================
   الصفحة الرئيسية — ما قبل تسجيل الدخول.
   ----------------------------------------------------------------------------
   مبنية على نظام NEBULA بالكامل: صفر style={{ }}، كل شي بتوكنز الهوية.
   الفضاء بيدخل عبر حقل نجوم حقيقي + مخطّط مداري + حواف إيريدسنت — مش صور
   جاهزة ولا كواكب كرتونية.

   ═══ اللغة ═══
   نصوص الصفحة كانت **مكتوبة بالكود مباشرة**، فما كان إلها نسخة تانية أصلاً —
   وهاد اللي منع وضع زرّ اللغة عليها مع إنّ النظام (`LocaleProvider`) شغّال
   بباقي المنصّة من زمان. انتقلت كلها لنطاق `landing` بالقاموسين.

   ⚠️ و`dir` كان **مثبّتاً `"rtl"`** على الجذر — يعني حتى لو انبدلت اللغة،
   الصفحة بتضل تترتّب من اليمين. صار من `useLocale()`.
   ============================================================================ */

/* ═══════════════════════════════════════════════════════════════════════════
   عنوان القسم الصغير — **تنسيقه بيتبدّل مع اللغة، مش بس نصّه.**
   ---------------------------------------------------------------------------
   التنسيق اللاتيني (`font-mono` · `uppercase` · `tracking-[0.28em]`) بيكسر
   العربي بتلات طرق:
     · `font-mono` = IBM Plex Mono، و**ما فيه حروف عربية** — فبيقع على خط
       النظام الاحتياطي، وبيبان غريباً عن باقي الصفحة.
     · `tracking-[0.28em]` بيباعد الحروف، والعربي **متّصل** — فالكلمة بتنفك
       لحروف مقطّعة. هاد أوضح خطأ طباعي بيصير لما ينترجم نص لاتيني بحرفه.
     · `uppercase` بلا معنى بالعربي (ما في حالة أحرف).
   فالعربي بياخد خط الواجهة بلا تباعد ولا تكبير، واللاتيني بيضل كما صُمِّم.
   ═══════════════════════════════════════════════════════════════════════════ */
function Eyebrow({ children, isRtl }) {
  return (
    <p
      className={
        isRtl
          ? "mb-3 text-caption font-semibold text-violet-100"
          : "mb-3 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-violet-100"
      }
    >
      {children}
    </p>
  );
}

/* ظهور تدريجي بالسكرول — بيشتغل مرة وحدة لكل عنصر وبعدها بيفصل المراقب */
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-[900ms] ease-orbit ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* الرمز والأيقونة ثابتان — النص بيجي من القاموس. الرمز (`FND`/`ICT`…)
   **معرّف مش نص**: بيضل لاتينياً بالحالتين زي ما هو بالتصميم. */
const CURRICULUM = [
  { code: "FND", Icon: BookOpen, k: "fnd" },
  { code: "FUN", Icon: LineChart, k: "fun" },
  { code: "ICT", Icon: Target, k: "ict" },
  { code: "SK", Icon: Radio, k: "sk" },
  { code: "DEMO", Icon: GraduationCap, k: "demo" },
  { code: "BT", Icon: Repeat, k: "bt" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   الأدوات — كل بند منهن **موجود بقائمة تنقّل الأعضاء** (`navigation.js`).
   ---------------------------------------------------------------------------
   القسم انضاف لأنّ الصفحة كانت تبيع محاضرات وبس، بينما المنصّة صار فيها
   أدوات تحليل كاملة ما كانت مذكورة ولا مرة — لا بالصفحة ولا بوصف جوجل.
   ⚠️ ولا بند مكتوب على نيّة: أي إشي مش موجود بالتنقّل ما بينكتب هون.
   ═══════════════════════════════════════════════════════════════════════════ */
/* ⚠️ **`featured` قرار بصري مش محتوى.** الاستعراض التاريخي هو أكبر أداة
   بالمنصّة فعلياً (شارتات متزامنة · قص · رسم · إعادة تشغيل)، فأخذه للمساحة
   الأكبر بيعكس الواقع بدل ما يوزّع الأهمية بالتساوي على ستّة متشابهين.
   الترتيب هون بيحدّد مكان الخليّة بالشبكة: البطل بياخد ٢×٢ والباقي بيلتفّ
   حواليه (٣ أعمدة × ٣ صفوف = ٩ خلايا = ٤ + ٥). */
const TOOLS = [
  { k: "replay", Icon: Target, featured: true },
  { k: "radar", Icon: Radar },
  { k: "journal", Icon: BarChart3 },
  { k: "reports", Icon: FileText },
  { k: "dna", Icon: Dna },
  { k: "calendar", Icon: CalendarDays },
];

function SectionHead({ eyebrow, title, isRtl, align = "center" }) {
  const centered = align === "center";
  return (
    <div className={centered ? "text-center" : ""}>
      <Reveal>
        <Eyebrow isRtl={isRtl}>{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={90}>
        {/* `\n` بالقاموس = كسر سطر مقصود بالعنوان. الترجمتان بتحطّاه بمكانه
            الطبيعي بلغتها، فما بينفرض كسر إنجليزي على العربي ولا العكس. */}
        <h2
          className={`whitespace-pre-line text-balance text-2xl font-bold leading-tight tracking-tight text-text-primary md:text-3xl ${
            centered ? "mx-auto max-w-[22ch]" : "max-w-[26ch]"
          }`}
        >
          {title}
        </h2>
      </Reveal>
      {/* خط تدرّج بيمتدّ من العنوان — عنصر هندسي بيفصل العنوان عن المحتوى
          بلا ما يضيف صندوقاً. بالمحاذاة للبداية بيمتدّ باتجاه القراءة. */}
      <Reveal delay={160}>
        <span
          aria-hidden
          className={`mt-6 block h-px ${centered ? "mx-auto w-24" : "w-40"}`}
          style={{
            backgroundImage: `linear-gradient(to ${isRtl ? "left" : "right"}, #7C4DFF, rgba(124,77,255,0))`,
          }}
        />
      </Reveal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   صفّ المسار — بديل بطاقة المنهج
   ---------------------------------------------------------------------------
   🔴 **الشبكة كانت تخفي أهم خاصية بالمحتوى.** المنهج **متسلسل** («من
   الأساسيات حتى الاحترافية»)، وستّ بطاقات متساوية بشبكة `gap-px` بتعرضهن
   كخيارات متوازية — يعني الشكل بيناقض المعنى، وبيعطي إحساس جدول.

   الصف بيعيد التسلسل: رقم مرحلة كبير، عمود فقري بيربطهن، وعقدة بتضوي مع
   المرور. والأيقونة صارت **علامة مائية جوّا الصف نفسه** بدل مربّع ٩×٩
   معزول — وهاد بالضبط نمط بطاقة SaaS اللي طلب شيله.
   ⚠️ ولا لون جديد: البنفسجي للتفاعل و`edge` للمعدن، زي ما هي قواعد البالِت.
   ═══════════════════════════════════════════════════════════════════════════ */
function TrackRow({ index, code, Icon, title, desc, isRtl }) {
  return (
    <li className="group relative isolate">
      {/* التوهّج المحيطي — بيدخل من جهة البداية وبيخفت، فبيقرأ كضوء ماشي
          على العمود مش كخلفية بطاقة. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -inset-x-5 -z-10 opacity-0 transition-opacity duration-slow ease-orbit group-hover:opacity-100"
        style={{
          backgroundImage: `linear-gradient(to ${isRtl ? "left" : "right"}, rgba(124,77,255,0.10), rgba(124,77,255,0) 58%)`,
        }}
      />
      {/* العمود الفقري: خط معدني ثابت، وفوقه ضوء بينزل مع المرور */}
      <span aria-hidden className="absolute inset-y-0 start-0 w-px bg-edge" />
      <span
        aria-hidden
        className="absolute inset-y-0 start-0 w-px origin-top scale-y-0 bg-gradient-to-b from-violet-200 via-violet-200/35 to-transparent transition-transform duration-slow ease-orbit group-hover:scale-y-100"
      />
      {/* العقدة — معيّن صغير على الخط. مركزها بيتعدّل مع الاتجاه. */}
      <span
        aria-hidden
        className={`absolute start-0 top-[2.1rem] h-1.5 w-1.5 rotate-45 bg-edge-bright transition-colors duration-base ease-orbit group-hover:bg-violet-200 ${
          isRtl ? "translate-x-1/2" : "-translate-x-1/2"
        }`}
      />

      <div className="relative flex items-start gap-5 py-7 ps-7 sm:gap-7 sm:ps-9">
        <span
          aria-hidden
          className="font-num text-2xl font-bold leading-none text-edge-bright transition-colors duration-slow ease-orbit group-hover:text-violet-100 sm:text-3xl"
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            {/* الرمز **معرّف** مش نص — بيضل لاتينياً بالحالتين، فبيحتفظ
                بالتباعد المصمَّم إله بلا ما يمسّ العربي. */}
            <span className="font-mono text-micro tracking-[0.18em] text-text-faint" dir="ltr">
              {code}
            </span>
          </div>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-text-muted">{desc}</p>
        </div>

        {/* العلامة المائية — كبيرة وخافتة، جزء من الصف مش صندوق جنبه */}
        <Icon
          aria-hidden
          className="pointer-events-none absolute end-0 top-1/2 hidden h-20 w-20 -translate-y-1/2 text-violet-200/[0.055] transition-all duration-slow ease-orbit group-hover:scale-105 group-hover:text-violet-200/[0.12] md:block"
        />
      </div>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   بطاقة أداة — تكوين غير متماثل (bento)
   ---------------------------------------------------------------------------
   🔴 القسم كان **نسخة حرفية** من شبكة المنهج: نفس `gap-px`، نفس المربّع
   ٩×٩، نفس المقاسات. فالصفحة كانت تقرأ «عنوان ← شبكة ← عنوان ← شبكة».

   هون البطاقة الأولى **بطل** (عمودان × صفّان) وفيها زخرفة شموع — وهي حرفياً
   شغل الأداة نفسها. والباقي بمقاسات أصغر، فصار في تدرّج هرمي فعلي.

   ⚠️ الأيقونة صارت **طبقتين**: شبح كبير بيخرج من ركن البطاقة (جزء من
   التكوين)، وأيقونة صغيرة ملاصقة للعنوان (وظيفة). ما عاد في مربّع محدود.
   ⚠️ والحواف قائمة عمداً — `borderRadius.DEFAULT = 3px` بنظام ORBIT،
   و«الانحناء بس للعناصر الصغيرة اللمسية». التدوير هون بيحوّلها لقالب SaaS.
   ═══════════════════════════════════════════════════════════════════════════ */
function ToolCard({ Icon, title, desc, featured = false, className = "" }) {
  return (
    <article
      className={`group relative isolate overflow-hidden border border-edge bg-module-1 shadow-edge transition-[transform,border-color,background-color] duration-slow ease-orbit hover:-translate-y-0.5 hover:border-edge-lit hover:bg-module-2 ${
        featured ? "p-7 sm:p-8" : "p-6"
      } ${className}`}
    >
      {/* توهّج محيطي محسوب — بيطلع من أسفل البطاقة عند المرور وبس */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-slow ease-orbit group-hover:opacity-100"
        style={{
          backgroundImage: featured
            ? "radial-gradient(110% 80% at 50% 118%, rgba(124,77,255,0.20), transparent 62%)"
            : "radial-gradient(120% 90% at 50% 122%, rgba(124,77,255,0.14), transparent 60%)",
        }}
      />
      {/* لمعة الحافة العليا — عمق بلا ظل ثقيل */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60 transition-opacity duration-slow ease-orbit group-hover:opacity-100"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent, rgba(196,176,255,0.34), transparent)",
        }}
      />

      {/* شبح الأيقونة — بيطلع من الركن، فبيصير جزء من هندسة البطاقة */}
      <span aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-end">
        <Icon
          className={`-me-5 -mt-5 text-violet-200/[0.05] transition-all duration-slow ease-orbit group-hover:-translate-y-1 group-hover:text-violet-200/[0.10] ${
            featured ? "h-40 w-40" : "h-24 w-24"
          }`}
        />
      </span>

      <div className="relative flex h-full flex-col">
        <h3
          className={`flex items-center gap-2.5 font-semibold text-text-primary ${
            featured ? "text-xl" : "text-lg"
          }`}
        >
          <Icon
            aria-hidden
            className={`shrink-0 text-violet-100 transition-colors duration-base ease-orbit group-hover:text-cyan-100 ${
              featured ? "h-5 w-5" : "h-4 w-4"
            }`}
          />
          {title}
        </h3>
        <p
          className={`mt-2.5 leading-relaxed text-text-muted ${
            featured ? "max-w-[46ch] text-base" : "text-sm"
          }`}
        >
          {desc}
        </p>

        {featured && <CandleMotif />}
      </div>
    </article>
  );
}

/* زخرفة الشموع — تحت البطاقة البطل. بتوصف الأداة نفسها (شارت مقصوص عند
   لحظة) بدل صورة عامة. بألوان البالِت وبشفافية منخفضة حتى تضل خلفية. */
function CandleMotif() {
  const CANDLES = [
    [4, 26, 12, 1], [20, 18, 16, 1], [36, 22, 10, 0], [52, 12, 20, 1],
    [68, 20, 12, 0], [84, 8, 22, 1], [100, 16, 14, 1], [116, 24, 10, 0],
    [132, 10, 18, 1], [148, 18, 14, 1],
  ];
  return (
    <div aria-hidden className="pointer-events-none mt-auto pt-8">
      <svg viewBox="0 0 168 44" className="h-16 w-full max-w-[19rem]" fill="none">
        {CANDLES.map(([x, y, h, up], i) => (
          <g key={i} className="transition-opacity duration-slow ease-orbit">
            <line
              x1={x + 4} y1={y - 5} x2={x + 4} y2={y + h + 5}
              stroke={up ? "#7C4DFF" : "#3D2F63"} strokeWidth="1"
              opacity={0.45}
            />
            <rect
              x={x} y={y} width="8" height={h}
              fill={up ? "#7C4DFF" : "#241C3E"}
              stroke={up ? "#C4B0FF" : "#3D2F63"} strokeWidth="0.6"
              opacity={0.55}
            />
          </g>
        ))}
        {/* خط القص — قلب أداة الاستعراض */}
        <line x1="112" y1="0" x2="112" y2="44" stroke="#22D3EE" strokeWidth="1" strokeDasharray="3 3" opacity="0.75" />
      </svg>
    </div>
  );
}

export default function HomePage() {
  const { t, dir } = useLocale();
  const isRtl = dir === "rtl";
  /* ⚠️ **السهم بينقلب مع اللغة.** كان `ArrowLeft` مثبَّتاً — وهو صحيح بالعربي
     (اتجاه القراءة لليسار) وبيصير **معكوساً** بالإنجليزي: زرّ «ابدأ» بيشاور
     لورا. والحركة عند المرور لازم تتبعه كمان. */
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const arrowHover = isRtl
    ? "transition-transform duration-base group-hover:-translate-x-1"
    : "transition-transform duration-base group-hover:translate-x-1";

  return (
    <div className="min-h-screen bg-space-1 font-sans text-text-primary" dir={dir}>
      {/* ═══════════ الشريط العلوي ═══════════ */}
      <header className="glass sticky top-0 z-header border-b border-edge">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <Logo size={28} withWordmark />
          <nav className="flex items-center gap-2">
            {/* ⚠️ **نفس مكوّن الشِل** — مش نسخة تانية. اللغة بتنحفظ بالكوكي
                وبالتخزين المحلي وبحساب المستخدم لو مسجّل دخول، فاختياره هون
                بيرافقه بعد ما يفوت. */}
            <LanguageSwitcher className="me-1" />
            <Link
              href="/login"
              className="px-3 py-2 text-caption text-text-secondary transition-colors duration-base hover:text-text-primary"
            >
              {t("landing.nav.login")}
            </Link>
            <Link
              href="/signup"
              className="rounded-sm bg-violet-200 px-4 py-2 text-caption font-semibold text-space-0 transition-colors duration-base hover:bg-violet-100"
            >
              {t("landing.nav.signup")}
            </Link>
          </nav>
        </div>
      </header>

      {/* ═══════════ البطل ═══════════ */}
      <section className="relative overflow-hidden border-b border-edge">
        {/* ⚠️ **الترتيب مقصود**: النجوم والشهب الطبقة الأعمق، والشعار المكبَّر
            فوقهن. قراره: «ما بدنا نتخلّى عن النجوم والشهب». */}
        <Starfield density={1.1} className="opacity-90" />
        {/* ⚠️ الشعار بيقعد **مقابل** النص — والنص بجهة بداية القراءة. بلا
            هاد، الإنجليزية بتحط الاتنين على اليسار فيتراكبوا (مقيس). */}
        <OrbitBackdrop side={isRtl ? "start" : "end"} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 55% at 25% 0%, rgba(124,77,255,0.22), transparent 62%), radial-gradient(50% 45% at 85% 25%, rgba(34,211,238,0.10), transparent 60%)",
          }}
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-pill border border-edge-lit bg-module-1/70 px-3 py-1 text-micro text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" aria-hidden />
                {t("landing.hero.badge")}
              </span>
            </Reveal>

            <Reveal delay={100}>
              <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.12] tracking-tight md:text-[3.25rem]">
                {t("landing.hero.titleTop")}
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(115deg,#C4B0FF 0%,#7C4DFF 45%,#22D3EE 100%)" }}
                >
                  {t("landing.hero.titleAccent")}
                </span>
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-text-secondary">
                {t("landing.hero.subtitle")}
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-sm bg-violet-200 px-6 py-3 text-sm font-semibold text-space-0 shadow-glow-violet transition-colors duration-base hover:bg-violet-100"
                >
                  {t("landing.hero.ctaPrimary")}
                  <Arrow className={`h-4 w-4 ${arrowHover}`} aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="rounded-sm border border-edge-lit px-6 py-3 text-sm text-text-secondary transition-colors duration-base hover:border-violet-300 hover:text-text-primary"
                >
                  {t("landing.hero.ctaSecondary")}
                </Link>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-px border border-edge bg-edge">
                {[
                  ["6", t("landing.hero.statDemo")],
                  ["4", t("landing.hero.statMethods")],
                  ["∞", t("landing.hero.statBacktest")],
                ].map(([num, label]) => (
                  <div key={label} className="bg-module-1 px-3 py-3.5 text-center">
                    <dt className="font-num text-2xl font-bold leading-none text-text-primary">
                      {num}
                    </dt>
                    <dd className="mt-1.5 text-micro leading-snug text-text-muted">{label}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          {/* ⚠️ **العمود التاني انفضى عمداً.** كان فيه `OrbitDiagram` بمقاس
              ٤٠٠px محصور بخليّة الشبكة. صار الشعار خلفية للقسم كله
              (`OrbitBackdrop` فوق) — طلبه: «بدي إشي كبير يغطي مساحة كبيرة من
              الخلفية». والخليّة بتضل موجودة عشان النص يبقى بنصف العرض على
              الشاشات الكبيرة بدل ما يتمدّد ويمرق فوق المدارات. */}
          <div aria-hidden />
        </div>
      </section>

      {/* ═══════════ المنهج — مسار مرقَّم بعنوان لاصق ═══════════ */}
      {/* ⚠️ **تكوين عمودَين بعنوان لاصق** مش «عنوان فوق ← محتوى تحت».
          العنوان بيضل ثابتاً وانت بتمرّ على المراحل، فبتحسّ إنك بتمشي **جوّا**
          القسم مش بتقرأ قائمة تانية. وهاد بيحلّ مشكلتين مع بعض: بيكسر تكرار
          «عنوان ← شبكة»، وبيضيّق عمود النص فبتصير العلامة المائية ملاصقة
          للصف بدل ما تطوف بطرف الصفحة (كانت تبعد ٤٠٠px عن النص). */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHead
              isRtl={isRtl}
              align="start"
              eyebrow={t("landing.curriculum.eyebrow")}
              title={t("landing.curriculum.title")}
            />
          </div>

          <ol>
            {CURRICULUM.map((item, i) => (
              <Reveal key={item.code} delay={i * 60}>
                <TrackRow
                  index={i}
                  code={item.code}
                  Icon={item.Icon}
                  isRtl={isRtl}
                  title={t(`landing.curriculum.${item.k}Title`)}
                  desc={t(`landing.curriculum.${item.k}Desc`)}
                />
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════ الأدوات — تكوين غير متماثل ═══════════ */}
      <section className="relative overflow-hidden border-y border-edge bg-space-2/40">
        {/* توهّج محيطي خافت جداً — بيعطي القسم عمقاً بلا ما يضيف عنصراً */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(65% 45% at 50% 0%, rgba(124,77,255,0.13), transparent 62%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-5 py-24">
          <SectionHead
            isRtl={isRtl}
            eyebrow={t("landing.tools.eyebrow")}
            title={t("landing.tools.title")}
          />

          {/* ⚠️ **مش `gap-px`.** الفراغ الحقيقي بيخلّي كل بطاقة كتلة قائمة
              بذاتها بدل خليّة بجدول — وهاد أكبر فرق بين «شبكة» و«تكوين».
              البطاقة الأولى بتاخد عمودين وصفّين، فالشبكة بتنبني حواليها. */}
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
            {TOOLS.map((tool, i) => (
              <Reveal
                key={tool.k}
                delay={i * 60}
                className={tool.featured ? "sm:col-span-2 lg:row-span-2" : ""}
              >
                <ToolCard
                  Icon={tool.Icon}
                  featured={tool.featured}
                  className="h-full"
                  title={t(`landing.tools.${tool.k}Title`)}
                  desc={t(`landing.tools.${tool.k}Desc`)}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ طريقة التعلّم ═══════════ */}
      <section className="border-y border-edge bg-space-2/60">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2">
          <div>
            <Reveal>
              <Eyebrow isRtl={isRtl}>{t("landing.how.eyebrow")}</Eyebrow>
              <h2 className="whitespace-pre-line text-balance text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                {t("landing.how.title")}
              </h2>
              <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-text-secondary">
                {t("landing.how.body")}
              </p>
            </Reveal>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              🔴 **قائمة صحّات = تعداد، مش عملية.**
              -------------------------------------------------------------
              القسم اسمه «آلية التعلّم» — يعني بيوصف **مساراً**، وأربع علامات
              صح بصفوف متطابقة بتعرضه كقائمة مزايا. الدرج بيربطهن بخط واحد
              وبيعطي كل مرحلة عقدة، فالشكل بيوافق المعنى.
              ⚠️ النصوص الأربعة كما هي حرفياً — التغيير بالتقديم وبس.
              ═══════════════════════════════════════════════════════════════ */}
          <Reveal delay={150}>
            <div className="relative border border-edge bg-module-1 p-7 shadow-module sm:p-8">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, transparent, rgba(196,176,255,0.4), transparent)",
                }}
              />
              <ol className="relative">
                {["f1", "f2", "f3", "f4"].map((k, i, arr) => (
                  <li key={k} className="group relative flex gap-4 pb-6 last:pb-0">
                    {/* الخط الواصل — بيوقف عند آخر مرحلة. `start-` منطقية
                        فبتتبع الاتجاه، ومركزها على منتصف العقدة (١٤px ÷ ٢). */}
                    {i < arr.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute bottom-0 start-[7px] top-5 w-px bg-edge"
                      />
                    )}
                    <span
                      aria-hidden
                      className="relative mt-1 grid h-3.5 w-3.5 shrink-0 rotate-45 place-items-center border border-edge-lit bg-module-1 transition-colors duration-base ease-orbit group-hover:border-violet-200 group-hover:bg-violet-300/25"
                    />
                    <span className="text-sm leading-relaxed text-text-secondary transition-colors duration-base ease-orbit group-hover:text-text-primary">
                      {t(`landing.how.${k}`)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ السعر ═══════════ */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-24">
        <SectionHead
          isRtl={isRtl}
          eyebrow={t("landing.pricing.eyebrow")}
          title={t("landing.pricing.title")}
        />

        <Reveal delay={150}>
          <div className="mod mod-iri mx-auto mt-12 max-w-lg shadow-glow-violet">
            <div className="relative overflow-hidden mod-in p-8">
              <h3 className="relative text-center text-lg font-semibold text-text-primary">
                {t("landing.pricing.planName")}
              </h3>

              {/* ═══════════════════════════════════════════════════════════
                  حلقة مدارية خلف الرقم — نفس هندسة الشعار.
                  ---------------------------------------------------------
                  الرقم كان طايفاً على خلفية مسطّحة. الحلقة بتعطيه مركزاً
                  ولحظة عمق، وبتربط البطاقة بالهوية بدل ما تبان بطاقة تسعير
                  عامة. ⚠️ شفافية منخفضة عمداً — العنصر البطل هو **الرقم**.
                  ═══════════════════════════════════════════════════════════ */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-16 flex justify-center"
              >
                {/* ⚠️ المقاس مضبوط على **الرقم** مش على البطاقة: بحلقة أوسع
                    كانت المنقّطة تمرق فوق سطر «ثم $100 شهرياً» فتزحمه. */}
                <svg viewBox="0 0 220 220" className="h-44 w-44" fill="none">
                  <circle cx="110" cy="110" r="74" stroke="#3D2F63" strokeWidth="1.2" opacity="0.65" />
                  <ellipse
                    cx="110" cy="110" rx="74" ry="27"
                    stroke="#7C4DFF" strokeWidth="1.2" opacity="0.4"
                    transform="rotate(-28 110 110)"
                  />
                  <circle
                    cx="110" cy="110" r="96"
                    stroke="#C4B0FF" strokeWidth="4" strokeOpacity="0.10"
                    strokeDasharray="1.5 10"
                  />
                  <circle cx="36" cy="110" r="2.5" fill="#22D3EE" opacity="0.45" />
                </svg>
              </div>

              <div className="relative mt-6 flex items-end justify-center gap-1.5" dir="ltr">
                <span className="mb-2 font-num text-xl text-text-muted">$</span>
                <span className="font-num text-6xl font-extrabold leading-none tracking-tighter text-text-primary">
                  300
                </span>
              </div>
              {/* ⚠️ `relative` على كل اللي بعد الحلقة: العنصر المطلَق بينرسم
                  **فوق** إخوته الساكنين، فبلاها الحلقة بتغطّي القائمة والزر. */}
              <p className="relative mt-2 text-center text-caption text-text-muted">
                {t("landing.pricing.atSignup")}
              </p>

              {/* ⚠️ المبلغ جوّا الجملة، وموقعه بيختلف بين اللغتين — فالنص
                  بالقاموس فيه `<b>` وبينحقن هون. المحتوى **ثابت بالقاموسين**
                  وما بيجي من مستخدم ولا من قاعدة بيانات، فما في مدخل حقن. */}
              <p
                className="relative mt-4 text-center text-caption text-text-secondary [&>b]:font-num [&>b]:font-semibold [&>b]:text-text-primary"
                dangerouslySetInnerHTML={{ __html: t("landing.pricing.thenMonthly") }}
              />

              <ul className="relative mt-7 flex flex-col gap-3 border-y border-edge py-6">
                {["f1", "f2", "f3"].map((k) => (
                  <li key={k} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-cyan-200/15 text-cyan-100">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    <span className="text-sm text-text-secondary">{t(`landing.pricing.${k}`)}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="relative mt-7 block rounded-sm bg-violet-200 py-3.5 text-center text-sm font-semibold text-space-0 transition-colors duration-base hover:bg-violet-100"
              >
                {t("landing.pricing.cta")}
              </Link>

              <p className="relative mt-4 text-center text-micro leading-relaxed text-text-faint">
                {t("landing.pricing.taxNote")}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ الدعوة الأخيرة ═══════════ */}
      <section className="relative overflow-hidden border-t border-edge">
        <Starfield density={0.7} parallax={false} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 90% at 50% 100%, rgba(124,77,255,0.20), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center">
          <Reveal>
            <Logo size={52} className="mx-auto mb-7" />
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
              {t("landing.final.title")}
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-4 max-w-[42ch] text-base text-text-secondary">
              {t("landing.final.body")}
            </p>
          </Reveal>
          <Reveal delay={300}>
            <Link
              href="/signup"
              className="group mt-8 inline-flex items-center gap-2 rounded-sm bg-violet-200 px-7 py-3.5 text-sm font-semibold text-space-0 shadow-glow-violet transition-colors duration-base hover:bg-violet-100"
            >
              {t("landing.final.cta")}
              <Arrow className={`h-4 w-4 ${arrowHover}`} aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ التذييل ═══════════ */}
      <footer className="border-t border-edge bg-space-0">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-10">
          <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-caption">
            {[
              ["/terms", t("landing.footer.terms")],
              ["/privacy", t("landing.footer.privacy")],
              ["/refund-policy", t("landing.footer.refund")],
            ].map(([href, label], i) => (
              <span key={href} className="flex items-center gap-2">
                {i > 0 && <span className="text-text-faint" aria-hidden>·</span>}
                <Link
                  href={href}
                  className="text-text-muted transition-colors duration-base hover:text-text-secondary"
                >
                  {label}
                </Link>
              </span>
            ))}
            <span className="text-text-faint" aria-hidden>·</span>
            <a
              href="mailto:qaisalraifai@gmail.com"
              className="text-text-muted transition-colors duration-base hover:text-text-secondary"
            >
              {t("landing.footer.contact")}
            </a>
          </nav>

          <p className="flex items-center gap-2 text-micro text-text-faint">
            <Users className="h-3 w-3" aria-hidden />
            <span dir="ltr">© {new Date().getFullYear()} Qais Trading Academy</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
