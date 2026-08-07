"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  GraduationCap,
  LineChart,
  Radio,
  Repeat,
  Target,
  Users,
} from "lucide-react";
import Logo from "./components/brand/Logo";
import Starfield from "./components/brand/Starfield";
import OrbitDiagram from "./components/brand/OrbitDiagram";

/* ============================================================================
   الصفحة الرئيسية — ما قبل تسجيل الدخول.
   ----------------------------------------------------------------------------
   مبنية على نظام NEBULA بالكامل: صفر style={{ }}، كل شي بتوكنز الهوية.
   الفضاء بيدخل عبر حقل نجوم حقيقي + مخطّط مداري + حواف إيريدسنت — مش صور
   جاهزة ولا كواكب كرتونية.
   ============================================================================ */

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

const CURRICULUM = [
  { code: "FND", Icon: BookOpen, title: "أساسيات التداول", desc: "فهم الأسواق، أنواع الأدوات المالية، وإدارة رأس المال من الصفر." },
  { code: "FUN", Icon: LineChart, title: "التحليل الأساسي", desc: "قراءة الأخبار الاقتصادية والمؤشرات وتأثيرها المباشر على حركة السعر." },
  { code: "ICT", Icon: Target, title: "ICT", desc: "مفاهيم Inner Circle Trader لفهم سلوك السيولة وأثر المؤسسات الكبرى." },
  { code: "SK", Icon: Radio, title: "SK", desc: "منهجية SK المشتقة من التحليل الموجي (Elliott Wave) لقراءة دورات السعر." },
  { code: "DEMO", Icon: GraduationCap, title: "تدريب 6 أشهر ديمو", desc: "تطبيق عملي يومي على حساب تجريبي لصقل المهارة قبل رأس المال الحقيقي." },
  { code: "BT", Icon: Repeat, title: "Backtest مستمر", desc: "اختبار كل استراتيجية على بيانات تاريخية فعلية لقياس جدواها وتطويرها." },
];

const LEARNING = [
  "محاضرات مباشرة أسبوعية",
  "مكتبة محاضرات مسجّلة منظّمة",
  "اختبارات لقياس التقدّم",
  "دعم مباشر من المدرّب داخل Discord",
];

const PLAN_FEATURES = [
  "وصول فوري لجميع المحاضرات المسجّلة والمباشرة",
  "عضوية Discord الحصرية",
  "تدريب 6 أشهر على حساب ديمو",
  "دعم مباشر من المدرّب",
];

function SectionHead({ eyebrow, title, align = "center" }) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <Reveal>
        <p className="mb-3 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-violet-100">
          {eyebrow}
        </p>
      </Reveal>
      <Reveal delay={90}>
        <h2 className="mx-auto max-w-[22ch] text-balance text-2xl font-bold leading-tight tracking-tight text-text-primary md:text-3xl">
          {title}
        </h2>
      </Reveal>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-space-1 font-sans text-text-primary" dir="rtl">
      {/* ═══════════ الشريط العلوي ═══════════ */}
      <header className="glass sticky top-0 z-header border-b border-edge">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <Logo size={28} withWordmark />
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-2 text-caption text-text-secondary transition-colors duration-base hover:text-text-primary"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/signup"
              className="rounded-sm bg-violet-200 px-4 py-2 text-caption font-semibold text-space-0 transition-colors duration-base hover:bg-violet-100"
            >
              اشترك الآن
            </Link>
          </nav>
        </div>
      </header>

      {/* ═══════════ البطل ═══════════ */}
      <section className="relative overflow-hidden border-b border-edge">
        <Starfield density={1.1} className="opacity-90" />
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
                أكاديمية تداول متكاملة
              </span>
            </Reveal>

            <Reveal delay={100}>
              <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.12] tracking-tight md:text-[3.25rem]">
                السوق يكافئ
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(115deg,#C4B0FF 0%,#7C4DFF 45%,#22D3EE 100%)" }}
                >
                  من يفهمه
                </span>
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-text-secondary">
                منهج تداول كامل من الأساسيات حتى الاحترافية — محاضرات مباشرة ومسجّلة،
                وتدريب عملي مستمر على حساب ديمو لمدة ستة أشهر.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-sm bg-violet-200 px-6 py-3 text-sm font-semibold text-space-0 shadow-glow-violet transition-colors duration-base hover:bg-violet-100"
                >
                  ابدأ رحلتك الآن
                  <ArrowLeft
                    className="h-4 w-4 transition-transform duration-base group-hover:-translate-x-1"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/login"
                  className="rounded-sm border border-edge-lit px-6 py-3 text-sm text-text-secondary transition-colors duration-base hover:border-violet-300 hover:text-text-primary"
                >
                  تسجيل الدخول
                </Link>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-px border border-edge bg-edge">
                {[
                  ["6", "أشهر تدريب ديمو"],
                  ["4", "منهجيات تحليل"],
                  ["∞", "Backtest مستمر"],
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

          <Reveal delay={250} className="flex justify-center lg:justify-start">
            <OrbitDiagram size={400} />
          </Reveal>
        </div>
      </section>

      {/* ═══════════ المنهج ═══════════ */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <SectionHead eyebrow="Curriculum" title="ست ركائز تبني متداولاً كاملاً" />

        <div className="mt-12 grid gap-px border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-3">
          {CURRICULUM.map((item, i) => (
            <Reveal key={item.code} delay={i * 70}>
              <article className="group h-full bg-module-1 p-6 transition-colors duration-base hover:bg-module-2">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center border border-edge-lit text-violet-100 transition-colors duration-base group-hover:border-violet-300">
                    <item.Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="font-mono text-micro tracking-[0.18em] text-text-faint">
                    {item.code}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-text-primary">{item.title}</h3>
                <p className="text-sm leading-relaxed text-text-muted">{item.desc}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════ طريقة التعلّم ═══════════ */}
      <section className="border-y border-edge bg-space-2/60">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="mb-3 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-violet-100">
                How it works
              </p>
              <h2 className="text-balance text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                محاضرات مباشرة ومسجّلة،
                <br />
                منظّمة بالكامل
              </h2>
              <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-text-secondary">
                يصلك المحتوى عبر مجتمع Discord الخاص — محاضرات حيّة تفاعلية أسبوعية،
                ومكتبة كاملة من المحاضرات المسجّلة مرتّبة حسب التسلسل التعليمي.
              </p>
            </Reveal>
          </div>

          <Reveal delay={150}>
            <div className="mod mod-lit shadow-module">
              <div className="mod-in p-6">
                <ul className="flex flex-col gap-3">
                  {LEARNING.map((f) => (
                    <li key={f} className="flex items-start gap-3 border-b border-edge pb-3 last:border-b-0 last:pb-0">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-violet-200/15 text-violet-100">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                      <span className="text-sm text-text-secondary">{f}</span>
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
        <SectionHead eyebrow="Pricing" title="سعر واضح، بدون مفاجآت" />

        <Reveal delay={150}>
          <div className="mod mod-iri mx-auto mt-12 max-w-lg shadow-glow-violet">
            <div className="mod-in p-8">
              <h3 className="text-center text-lg font-semibold text-text-primary">
                عضوية Qais Trading Academy
              </h3>

              <div className="mt-6 flex items-end justify-center gap-1.5" dir="ltr">
                <span className="mb-2 font-num text-xl text-text-muted">$</span>
                <span className="font-num text-6xl font-extrabold leading-none tracking-tighter text-text-primary">
                  300
                </span>
              </div>
              <p className="mt-2 text-center text-caption text-text-muted">عند التسجيل</p>

              <p className="mt-4 text-center text-caption text-text-secondary">
                ثم <strong className="font-num font-semibold text-text-primary">$100</strong> شهرياً
                تلقائياً حتى تلغي الاشتراك
              </p>

              <ul className="mt-7 flex flex-col gap-3 border-y border-edge py-6">
                {PLAN_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-cyan-200/15 text-cyan-100">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    <span className="text-sm text-text-secondary">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="mt-7 block rounded-sm bg-violet-200 py-3.5 text-center text-sm font-semibold text-space-0 transition-colors duration-base hover:bg-violet-100"
              >
                اشترك الآن — $300
              </Link>

              <p className="mt-4 text-center text-micro leading-relaxed text-text-faint">
                الأسعار بالدولار الأمريكي (USD) وقابلة لتطبيق ضرائب حسب موقعك — بيتم
                احتسابها وعرضها بوضوح قبل إتمام الدفع.
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
              جاهز تبدأ؟
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-4 max-w-[42ch] text-base text-text-secondary">
              انضم الآن وابدأ رحلتك في عالم التداول الاحترافي.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <Link
              href="/signup"
              className="group mt-8 inline-flex items-center gap-2 rounded-sm bg-violet-200 px-7 py-3.5 text-sm font-semibold text-space-0 shadow-glow-violet transition-colors duration-base hover:bg-violet-100"
            >
              عرض خطط الاشتراك
              <ArrowLeft
                className="h-4 w-4 transition-transform duration-base group-hover:-translate-x-1"
                aria-hidden
              />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ التذييل ═══════════ */}
      <footer className="border-t border-edge bg-space-0">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-10">
          <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-caption">
            {[
              ["/terms", "الشروط والأحكام"],
              ["/privacy", "سياسة الخصوصية"],
              ["/refund-policy", "سياسة الاسترجاع"],
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
              تواصل معنا
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
