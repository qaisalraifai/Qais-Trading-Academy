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
const TOOLS = [
  { k: "replay", Icon: Target },
  { k: "radar", Icon: Radar },
  { k: "journal", Icon: BarChart3 },
  { k: "reports", Icon: FileText },
  { k: "dna", Icon: Dna },
  { k: "calendar", Icon: CalendarDays },
];

function SectionHead({ eyebrow, title, isRtl, align = "center" }) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <Reveal>
        <Eyebrow isRtl={isRtl}>{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={90}>
        {/* `\n` بالقاموس = كسر سطر مقصود بالعنوان. الترجمتان بتحطّاه بمكانه
            الطبيعي بلغتها، فما بينفرض كسر إنجليزي على العربي ولا العكس. */}
        <h2 className="mx-auto max-w-[22ch] whitespace-pre-line text-balance text-2xl font-bold leading-tight tracking-tight text-text-primary md:text-3xl">
          {title}
        </h2>
      </Reveal>
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

      {/* ═══════════ المنهج ═══════════ */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead
          isRtl={isRtl}
          eyebrow={t("landing.curriculum.eyebrow")}
          title={t("landing.curriculum.title")}
        />

        <div className="mt-12 grid gap-px border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-3">
          {CURRICULUM.map((item, i) => (
            <Reveal key={item.code} delay={i * 70}>
              <article className="group h-full bg-module-1 p-6 transition-colors duration-base hover:bg-module-2">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center border border-edge-lit text-violet-100 transition-colors duration-base group-hover:border-violet-300">
                    <item.Icon className="h-4 w-4" aria-hidden />
                  </span>
                  {/* الرمز **معرّف** مش نص — بيضل لاتينياً بالحالتين، فبيحتفظ
                      بالتباعد المصمَّم إله بلا ما يمسّ العربي. */}
                  <span className="font-mono text-micro tracking-[0.18em] text-text-faint" dir="ltr">
                    {item.code}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-text-primary">
                  {t(`landing.curriculum.${item.k}Title`)}
                </h3>
                <p className="text-sm leading-relaxed text-text-muted">
                  {t(`landing.curriculum.${item.k}Desc`)}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ الأدوات ═══════════ */}
      <section className="border-t border-edge bg-space-2/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHead
            isRtl={isRtl}
            eyebrow={t("landing.tools.eyebrow")}
            title={t("landing.tools.title")}
          />

          <div className="mt-12 grid gap-px border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool, i) => (
              <Reveal key={tool.k} delay={i * 70}>
                <article className="group h-full bg-module-1 p-6 transition-colors duration-base hover:bg-module-2">
                  <span className="mb-4 grid h-9 w-9 place-items-center border border-edge-lit text-cyan-100 transition-colors duration-base group-hover:border-cyan-200">
                    <tool.Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <h3 className="mb-2 text-lg font-semibold text-text-primary">
                    {t(`landing.tools.${tool.k}Title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-text-muted">
                    {t(`landing.tools.${tool.k}Desc`)}
                  </p>
                </article>
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

          <Reveal delay={150}>
            <div className="mod mod-lit shadow-module">
              <div className="mod-in p-6">
                <ul className="flex flex-col gap-3">
                  {["f1", "f2", "f3", "f4"].map((k) => (
                    <li key={k} className="flex items-start gap-3 border-b border-edge pb-3 last:border-b-0 last:pb-0">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-violet-200/15 text-violet-100">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                      <span className="text-sm text-text-secondary">{t(`landing.how.${k}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ السعر ═══════════ */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead
          isRtl={isRtl}
          eyebrow={t("landing.pricing.eyebrow")}
          title={t("landing.pricing.title")}
        />

        <Reveal delay={150}>
          <div className="mod mod-iri mx-auto mt-12 max-w-lg shadow-glow-violet">
            <div className="mod-in p-8">
              <h3 className="text-center text-lg font-semibold text-text-primary">
                {t("landing.pricing.planName")}
              </h3>

              <div className="mt-6 flex items-end justify-center gap-1.5" dir="ltr">
                <span className="mb-2 font-num text-xl text-text-muted">$</span>
                <span className="font-num text-6xl font-extrabold leading-none tracking-tighter text-text-primary">
                  300
                </span>
              </div>
              <p className="mt-2 text-center text-caption text-text-muted">
                {t("landing.pricing.atSignup")}
              </p>

              {/* ⚠️ المبلغ جوّا الجملة، وموقعه بيختلف بين اللغتين — فالنص
                  بالقاموس فيه `<b>` وبينحقن هون. المحتوى **ثابت بالقاموسين**
                  وما بيجي من مستخدم ولا من قاعدة بيانات، فما في مدخل حقن. */}
              <p
                className="mt-4 text-center text-caption text-text-secondary [&>b]:font-num [&>b]:font-semibold [&>b]:text-text-primary"
                dangerouslySetInnerHTML={{ __html: t("landing.pricing.thenMonthly") }}
              />

              <ul className="mt-7 flex flex-col gap-3 border-y border-edge py-6">
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
                className="mt-7 block rounded-sm bg-violet-200 py-3.5 text-center text-sm font-semibold text-space-0 transition-colors duration-base hover:bg-violet-100"
              >
                {t("landing.pricing.cta")}
              </Link>

              <p className="mt-4 text-center text-micro leading-relaxed text-text-faint">
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
