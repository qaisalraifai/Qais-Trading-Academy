"use client";

import { useState } from "react";
import {
  Activity,
  Bot,
  Calendar,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Radar,
  Radio,
  Search,
  Settings,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Delta,
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  EmptyState,
  Field,
  IconButton,
  Input,
  KeyValue,
  Modal,
  Module,
  ModuleBody,
  ModuleHeader,
  ModuleRow,
  ModuleTitle,
  OrbitRing,
  ProgressBar,
  Select,
  Skeleton,
  SkeletonStatGrid,
  SkeletonText,
  Stat,
  StatCell,
  StatGrid,
  Switch,
  Table,
  TableBody,
  TableHead,
  TableRow,
  TableTd,
  TableTh,
  Tabs,
  Textarea,
  ToastProvider,
  Tooltip,
  useToast,
} from "@/app/components/ui";

/* ============================================================================
   معرض ORBIT — كل مكوّن بكل حالاته، قابل للتبديل بين العربي والإنجليزي.
   الغرض: مراجعة النظام كامل قبل ترحيل أي صفحة فعلية.
   ============================================================================ */

const COPY = {
  ar: {
    dir: "rtl",
    title: "ORBIT",
    subtitle: "نظام التصميم البصري لأكاديمية قيس",
    lang: "English",
    sections: {
      color: "البالِت",
      type: "الطباعة",
      modules: "الوحدات",
      buttons: "الأزرار",
      forms: "الحقول",
      data: "عرض البيانات",
      table: "الجداول",
      nav: "التنقّل",
      overlays: "الطبقات العائمة",
      states: "الحالات",
    },
  },
  en: {
    dir: "ltr",
    title: "ORBIT",
    subtitle: "Visual design system — Qais Trading Academy",
    lang: "العربية",
    sections: {
      color: "Palette",
      type: "Typography",
      modules: "Modules",
      buttons: "Buttons",
      forms: "Fields",
      data: "Data display",
      table: "Tables",
      nav: "Navigation",
      overlays: "Overlays",
      states: "States",
    },
  },
};

const PALETTE = [
  { group: "space", swatches: [["0", "#060911"], ["1", "#080B14"], ["2", "#0C1220"]] },
  { group: "module", swatches: [["1", "#111726"], ["2", "#182033"], ["3", "#1E2941"]] },
  {
    group: "edge",
    swatches: [["soft", "#1B2438"], ["DEFAULT", "#26314A"], ["lit", "#3E5478"], ["bright", "#55719E"]],
  },
  { group: "steel", swatches: [["100", "#D6DEEE"], ["200", "#A8B8D8"], ["300", "#7D8DAE"]] },
  { group: "ice", swatches: [["100", "#A8CFF5"], ["200", "#5FA8E8"], ["300", "#3C7FC0"], ["400", "#24507D"]] },
  { group: "au", swatches: [["100", "#E4CD95"], ["200", "#C9A860"], ["300", "#9C7F42"], ["400", "#5E4C27"]] },
  {
    group: "semantic",
    swatches: [["profit", "#1FBF87"], ["loss", "#E8495F"], ["warning", "#E0A44A"], ["info", "#5FA8E8"]],
  },
];

const RULES = {
  ar: {
    steel: "المعدن — الحواف والحلقات والأيقونات الثانوية",
    ice: "التفاعل فقط — الحالة النشطة، الروابط، التركيز",
    au: "القيمة المالية فقط — رصيد، عمولة، اشتراك، إنجاز",
    semantic: "نتيجة الصفقة فقط — ما بتستخدم كلون ديكور",
  },
  en: {
    steel: "Metal — edges, rings, secondary icons",
    ice: "Interaction only — active state, links, focus",
    au: "Monetary value only — balance, commission, subscription",
    semantic: "Trade outcome only — never decorative",
  },
};

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-edge py-10">
      <h2 className="eyebrow mb-5">{title}</h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Row({ label, children, className = "" }) {
  return (
    <div className="flex flex-col gap-2.5">
      {label && <p className="text-micro uppercase text-text-faint">{label}</p>}
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>{children}</div>
    </div>
  );
}

function ToastDemo({ locale }) {
  const toast = useToast();
  const t = locale === "ar";
  return (
    <Row label={t ? "إشعارات" : "Toasts"}>
      <Button size="sm" variant="secondary" onClick={() => toast.success(t ? "تم حفظ التغييرات" : "Changes saved")}>
        success
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => toast.error(t ? "فشل الحفظ" : "Save failed", t ? "تحقّق من اتصالك وحاول مرة تانية" : "Check your connection and try again")}
      >
        error
      </Button>
      <Button size="sm" variant="secondary" onClick={() => toast.warning(t ? "اشتراكك بينتهي بعد 3 أيام" : "Subscription ends in 3 days")}>
        warning
      </Button>
      <Button size="sm" variant="secondary" onClick={() => toast.info(t ? "صفقة جديدة على XAUUSD" : "New trade on XAUUSD")}>
        info
      </Button>
    </Row>
  );
}

function Gallery() {
  const [locale, setLocale] = useState("ar");
  const [tab, setTab] = useState("overview");
  const [tf, setTf] = useState("M15");
  const [modal, setModal] = useState(false);
  const [sw, setSw] = useState(true);

  const c = COPY[locale];
  const ar = locale === "ar";

  return (
    <div dir={c.dir} lang={locale} className="min-h-screen bg-space-1 text-text-primary">
      {/* ---------- الشريط العلوي ---------- */}
      <header className="sticky top-0 z-header flex h-header items-center justify-between gap-4 border-b border-edge glass px-4 md:px-6">
        <div className="flex items-baseline gap-3">
          <span className="font-num text-lg font-semibold tracking-tight">{c.title}</span>
          <span className="hidden text-caption text-text-muted sm:inline">{c.subtitle}</span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setLocale(ar ? "en" : "ar")}>
          {c.lang}
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 md:px-6">
        {/* ================= البالِت ================= */}
        <Section id="color" title={c.sections.color}>
          <div className="flex flex-col gap-4">
            {PALETTE.map(({ group, swatches }) => (
              <div key={group} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-caption text-text-secondary">{group}</span>
                  {RULES[locale][group] && (
                    <span className="text-micro text-text-muted">{RULES[locale][group]}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {swatches.map(([name, hex]) => (
                    <div key={name} className="w-[4.5rem]">
                      <div
                        className="h-11 border border-edge"
                        style={{ background: hex }}
                        aria-hidden
                      />
                      <p className="mt-1 font-mono text-[0.6rem] text-text-muted" dir="ltr">
                        {name}
                      </p>
                      <p className="font-mono text-[0.6rem] text-text-faint" dir="ltr">
                        {hex}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ================= الطباعة ================= */}
        <Section id="type" title={c.sections.type}>
          <div className="flex flex-col gap-4">
            {[
              ["text-3xl font-num font-semibold", "3xl / 36px", ar ? "‏$52,140.00" : "$52,140.00"],
              ["text-xl font-semibold", "xl / 22px", ar ? "مركز القيادة" : "Command Center"],
              ["text-lg font-semibold", "lg / 17px", ar ? "عنوان وحدة" : "Module title"],
              ["text-base", "base / 14.5px", ar ? "نص أساسي مقروء ومريح للفقرات الطويلة." : "Body copy, comfortable for longer reading."],
              ["text-sm text-text-secondary", "sm / 13px", ar ? "نص ثانوي" : "Secondary text"],
              ["text-caption text-text-muted", "caption / 12px", ar ? "شرح تحت الحقل" : "Field hint"],
              ["text-label uppercase text-text-muted", "label / 11px", ar ? "تسمية وحدة" : "Module label"],
              ["text-micro uppercase text-text-faint", "micro / 10px", ar ? "تسمية دقيقة" : "Micro label"],
              ["font-mono text-caption text-text-secondary", "mono / 12px", "XAUUSD · 14:32:07"],
            ].map(([cls, spec, sample]) => (
              <div
                key={spec}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-edge pb-3"
              >
                <span className={cls}>{sample}</span>
                <span className="font-mono text-micro text-text-faint" dir="ltr">
                  {spec}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ================= الوحدات ================= */}
        <Section id="modules" title={c.sections.modules}>
          <div className="grid gap-4 md:grid-cols-3">
            <Module level="primary" hover>
              <ModuleHeader meta="30D">
                <ModuleTitle>{ar ? "رأس المال" : "Capital"}</ModuleTitle>
              </ModuleHeader>
              <ModuleBody>
                <Stat
                  label={ar ? "الرصيد الحالي" : "Current balance"}
                  value="$52,140.00"
                  tone="value"
                  size="hero"
                  delta={6.72}
                  sub={ar ? "هذا الشهر" : "this month"}
                />
              </ModuleBody>
              <p className="border-t border-edge px-4 py-2 text-micro text-text-faint">
                level=primary · {ar ? "مشطوفة + حافة معدنية" : "chamfered + lit edge"}
              </p>
            </Module>

            <Module level="secondary">
              <ModuleHeader meta="48">
                <ModuleTitle ring={false} tick="ice">
                  {ar ? "الصفقات" : "Trades"}
                </ModuleTitle>
              </ModuleHeader>
              <ModuleBody>
                <Stat label={ar ? "نسبة النجاح" : "Win rate"} value="64.0%" size="md" sub={ar ? "31 ربح · 17 خسارة" : "31W · 17L"} />
              </ModuleBody>
              <p className="border-t border-edge px-4 py-2 text-micro text-text-faint">
                level=secondary · {ar ? "إطار عادي" : "plain border"}
              </p>
            </Module>

            <Module level="secondary">
              <ModuleHeader meta={ar ? "٣ اليوم" : "3 today"}>
                <ModuleTitle>{ar ? "الجلسات" : "Sessions"}</ModuleTitle>
              </ModuleHeader>
              <div className="px-4 pb-2">
                <ModuleRow>
                  <span className="flex-1 truncate text-sm">{ar ? "التحليل المتقدم" : "Advanced analysis"}</span>
                  <Badge variant="live" size="sm">{ar ? "مباشر" : "LIVE"}</Badge>
                </ModuleRow>
                <ModuleRow>
                  <span className="flex-1 truncate text-sm">{ar ? "أسئلة وأجوبة" : "Q&A session"}</span>
                  <span className="ltr-num text-caption text-text-muted">20:00</span>
                </ModuleRow>
                <ModuleRow>
                  <span className="flex-1 truncate text-sm">{ar ? "إدارة المخاطر" : "Risk management"}</span>
                  <span className="ltr-num text-caption text-text-muted">22:30</span>
                </ModuleRow>
              </div>
              <p className="border-t border-edge px-4 py-2 text-micro text-text-faint">
                ModuleRow · {ar ? "المستوى الثالث" : "level 3"}
              </p>
            </Module>
          </div>
        </Section>

        {/* ================= الأزرار ================= */}
        <Section id="buttons" title={c.sections.buttons}>
          <Row label="variants">
            <Button>{ar ? "الأساسي" : "Primary"}</Button>
            <Button variant="secondary">{ar ? "ثانوي" : "Secondary"}</Button>
            <Button variant="ghost">{ar ? "شبح" : "Ghost"}</Button>
            <Button variant="value" icon={Wallet}>{ar ? "سحب العمولة" : "Withdraw"}</Button>
            <Button variant="danger" icon={Trash2}>{ar ? "حذف" : "Delete"}</Button>
          </Row>
          <Row label="sizes / states">
            <Button size="sm">sm</Button>
            <Button size="md">md</Button>
            <Button size="lg">lg</Button>
            <Button loading>loading</Button>
            <Button disabled>disabled</Button>
            <Button variant="secondary" icon={TrendingUp} iconPosition="end">
              {ar ? "فتح التقرير" : "Open report"}
            </Button>
          </Row>
          <Row label="icon buttons">
            <IconButton icon={Search} label="Search" />
            <IconButton icon={Settings} label="Settings" />
            <IconButton icon={Activity} label="Activity" active />
          </Row>
        </Section>

        {/* ================= الحقول ================= */}
        <Section id="forms" title={c.sections.forms}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label={ar ? "بحث" : "Search"} hint={ar ? "الأيقونة بتقعد بالجهة الصح تلقائياً" : "Icon sits on the correct side automatically"}>
              <Input icon={Search} placeholder={ar ? "ابحث عن رمز أو دورة…" : "Search a symbol or course…"} />
            </Field>
            <Field label={ar ? "الزوج" : "Symbol"}>
              <Select defaultValue="XAUUSD">
                <option>XAUUSD</option>
                <option>BTCUSD</option>
                <option>EURUSD</option>
              </Select>
            </Field>
            <Field label={ar ? "المبلغ" : "Amount"} required error={ar ? "المبلغ لازم يكون أكبر من صفر" : "Amount must be greater than zero"}>
              <Input defaultValue="0" />
            </Field>
            <Field label={ar ? "ملاحظات الصفقة" : "Trade notes"}>
              <Textarea rows={3} placeholder={ar ? "سبب الدخول، المنطقة، إدارة المخاطر…" : "Entry reason, zone, risk plan…"} />
            </Field>
          </div>
          <Row label={ar ? "مفتاح" : "Switch"}>
            <Switch checked={sw} onChange={setSw} label={ar ? "التجديد التلقائي" : "Auto renew"} />
            <span className="text-sm text-text-secondary">{ar ? "التجديد التلقائي" : "Auto renew"}</span>
          </Row>
        </Section>

        {/* ================= عرض البيانات ================= */}
        <Section id="data" title={c.sections.data}>
          <StatGrid cols={4}>
            <StatCell>
              <Stat label={ar ? "رأس المال" : "Capital"} value="$52,140" tone="value" sub={ar ? "من $48,856" : "from $48,856"} />
            </StatCell>
            <StatCell>
              <Stat label={ar ? "ربح الشهر" : "Month P&L"} value="+$3,284" tone="profit" delta={6.42} />
            </StatCell>
            <StatCell>
              <Stat label={ar ? "نسبة النجاح" : "Win rate"} value="64.0%" sub={ar ? "48 صفقة" : "48 trades"} />
            </StatCell>
            <StatCell>
              <Stat label={ar ? "مفتوحة الآن" : "Open now"} value="3" tone="ice" sub={ar ? "تعرّض $8,400" : "$8,400 exposure"} />
            </StatCell>
          </StatGrid>

          <div className="grid gap-4 md:grid-cols-2">
            <Module level="secondary" padding="md">
              <p className="eyebrow mb-3">{ar ? "شرائط التقدّم" : "Progress"}</p>
              <div className="flex flex-col gap-3">
                <ProgressBar label={ar ? "أساسيات التحليل" : "Analysis basics"} value={92} showLabel tone="profit" />
                <ProgressBar label={ar ? "إدارة رأس المال" : "Capital management"} value={45} showLabel tone="ice" />
                <ProgressBar label={ar ? "نفسية المتداول" : "Trading psychology"} value={10} showLabel tone="steel" />
              </div>
            </Module>

            <Module level="secondary" padding="md">
              <p className="eyebrow mb-3">{ar ? "الحلقات المدارية" : "Orbit rings"}</p>
              <div className="flex flex-wrap items-center gap-5">
                <OrbitRing value={92} tone="profit" size={48} showValue label="92%" />
                <OrbitRing value={45} tone="ice" size={48} showValue label="45%" />
                <OrbitRing value={10} tone="steel" size={48} showValue label="10%" />
                <OrbitRing value={72} tone="value" size={48} showValue label="72%" />
              </div>
            </Module>
          </div>

          <Row label={ar ? "الشارات والتغيّرات" : "Badges & deltas"}>
            <Badge>default</Badge>
            <Badge variant="value">{ar ? "مدفوع" : "Paid"}</Badge>
            <Badge variant="profit">{ar ? "رابحة" : "Win"}</Badge>
            <Badge variant="loss">{ar ? "خاسرة" : "Loss"}</Badge>
            <Badge variant="info">{ar ? "قيد المراجعة" : "Review"}</Badge>
            <Badge variant="warning">{ar ? "ينتهي قريباً" : "Expiring"}</Badge>
            <Badge variant="live">{ar ? "مباشر" : "LIVE"}</Badge>
            <Delta value={6.72} />
            <Delta value={-1.18} />
            <Delta value={0} />
          </Row>

          <Row label={ar ? "تسمية / قيمة" : "Key / value"} className="!block max-w-xs">
            <KeyValue label={ar ? "الدخول" : "Entry"} value="2,398.20" />
            <KeyValue label={ar ? "وقف الخسارة" : "Stop loss"} value="2,384.00" tone="loss" />
            <KeyValue label={ar ? "جني الأرباح" : "Take profit"} value="2,431.00" tone="value" />
            <KeyValue label="R : R" value="1 : 2.3" mono />
          </Row>

          <Row label={ar ? "الصور الرمزية" : "Avatars"}>
            <Avatar initials="QA" size="sm" />
            <Avatar initials="QA" size="md" />
            <Avatar initials="QA" size="lg" />
            <Avatar initials="QA" size="xl" />
          </Row>
        </Section>

        {/* ================= الجداول ================= */}
        <Section id="table" title={c.sections.table}>
          <Module level="secondary" padding="md">
            <Table>
              <TableHead>
                <TableTh>{ar ? "الرمز" : "Symbol"}</TableTh>
                <TableTh>{ar ? "الاتجاه" : "Side"}</TableTh>
                <TableTh align="end">{ar ? "الدخول" : "Entry"}</TableTh>
                <TableTh align="end">{ar ? "الهدف" : "Target"}</TableTh>
                <TableTh>{ar ? "الحالة" : "Status"}</TableTh>
                <TableTh align="end">{ar ? "العائد" : "Return"}</TableTh>
              </TableHead>
              <TableBody>
                {[
                  ["XAUUSD", ar ? "شراء" : "Buy", "2,398.20", "2,431.00", true, "+0.61%", true],
                  ["BTCUSD", ar ? "بيع" : "Sell", "62,050", "60,400", false, "+1.90%", true],
                  ["EURUSD", ar ? "شراء" : "Buy", "1.0820", "1.0895", false, "−0.40%", false],
                  ["US100", ar ? "شراء" : "Buy", "18,240", "18,610", true, "+1.12%", true],
                ].map(([sym, side, entry, target, open, ret, up]) => (
                  <TableRow key={sym} onClick={() => {}}>
                    <TableTd strong className="font-mono">{sym}</TableTd>
                    <TableTd>{side}</TableTd>
                    <TableTd numeric align="end">{entry}</TableTd>
                    <TableTd numeric align="end">{target}</TableTd>
                    <TableTd>
                      <Badge variant={open ? "live" : "muted"} size="sm">
                        {open ? (ar ? "مفتوحة" : "Open") : ar ? "مغلقة" : "Closed"}
                      </Badge>
                    </TableTd>
                    <TableTd numeric align="end" className={up ? "text-profit" : "text-loss"}>
                      {ret}
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Module>
        </Section>

        {/* ================= التنقّل ================= */}
        <Section id="nav" title={c.sections.nav}>
          <div className="grid gap-4 md:grid-cols-2">
            <Module level="secondary" padding="none">
              <p className="eyebrow px-4 pb-2 pt-4">{ar ? "عناصر القائمة" : "Nav items"}</p>
              <nav className="pb-3">
                {[
                  [LayoutDashboard, ar ? "مركز القيادة" : "Command center", true],
                  [Radar, "Trading Radar", false],
                  [Bot, ar ? "صفقات QAIS AI" : "QAIS AI trades", false],
                  [Target, ar ? "Replay التدريب" : "Replay training", false],
                  [GraduationCap, ar ? "المحاضرات" : "Lectures", false],
                  [Radio, ar ? "البث المباشر" : "Live sessions", false],
                  [Calendar, ar ? "التقويم الاقتصادي" : "Economic calendar", false],
                  [Handshake, ar ? "العمولة والشبكة" : "Affiliate network", false],
                ].map(([Icon, label, active]) => (
                  <div
                    key={label}
                    className={`nav-item ${active ? "nav-item-active" : "nav-item-inactive"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{label}</span>
                  </div>
                ))}
              </nav>
            </Module>

            <div className="flex flex-col gap-4">
              <Module level="secondary" padding="md">
                <p className="eyebrow mb-3">Tabs · line</p>
                <Tabs
                  value={tab}
                  onChange={setTab}
                  items={[
                    { value: "overview", label: ar ? "نظرة عامة" : "Overview" },
                    { value: "trades", label: ar ? "الصفقات" : "Trades", count: 48 },
                    { value: "reports", label: ar ? "التقارير" : "Reports" },
                  ]}
                />
              </Module>

              <Module level="secondary" padding="md">
                <p className="eyebrow mb-3">Tabs · segment</p>
                <Tabs
                  variant="segment"
                  value={tf}
                  onChange={setTf}
                  items={["M1", "M5", "M15", "H1", "H4", "D1"].map((v) => ({ value: v, label: v }))}
                />
              </Module>

              <Module level="secondary" padding="md">
                <p className="eyebrow mb-3">Dropdown</p>
                <Dropdown
                  trigger={<Button variant="secondary" size="sm" icon={Settings}>{ar ? "خيارات" : "Options"}</Button>}
                >
                  <DropdownLabel>{ar ? "الصفقة" : "Trade"}</DropdownLabel>
                  <DropdownItem icon={TrendingUp}>{ar ? "فتح بالشارت" : "Open in chart"}</DropdownItem>
                  <DropdownItem icon={Activity} active>{ar ? "عرض التفاصيل" : "View details"}</DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem icon={Trash2} danger>{ar ? "حذف" : "Delete"}</DropdownItem>
                </Dropdown>
              </Module>
            </div>
          </div>
        </Section>

        {/* ================= الطبقات العائمة ================= */}
        <Section id="overlays" title={c.sections.overlays}>
          <Row label={ar ? "نافذة" : "Modal"}>
            <Button variant="secondary" onClick={() => setModal(true)}>
              {ar ? "افتح النافذة" : "Open modal"}
            </Button>
            <Tooltip label={ar ? "بيظهر بالهوفر وبالتركيز بلوحة المفاتيح" : "Shows on hover and keyboard focus"}>
              <Button variant="ghost" size="sm">Tooltip</Button>
            </Tooltip>
          </Row>

          <ToastDemo locale={locale} />

          <div className="grid gap-3 md:grid-cols-2">
            <Callout tone="info" title={ar ? "جلسة مباشرة بعد ساعة" : "Live session in an hour"}>
              {ar ? "التحليل الفني المتقدم — المستوى الثالث." : "Advanced technical analysis — level 3."}
            </Callout>
            <Callout tone="warning" title={ar ? "اشتراكك بينتهي قريباً" : "Subscription ending soon"}>
              {ar ? "باقي 3 أيام على انتهاء اشتراكك." : "3 days left on your subscription."}
            </Callout>
          </div>
        </Section>

        {/* ================= الحالات ================= */}
        <Section id="states" title={c.sections.states}>
          <div className="grid gap-4 md:grid-cols-2">
            <Module level="secondary" padding="md">
              <p className="eyebrow mb-3">{ar ? "تحميل" : "Loading"}</p>
              <div className="flex flex-col gap-3">
                <SkeletonStatGrid cols={2} />
                <SkeletonText lines={3} />
                <Skeleton className="h-20 w-full" />
              </div>
            </Module>

            <Module level="secondary" padding="none">
              <EmptyState
                icon={Bot}
                title={ar ? "ما في صفقات بعد" : "No trades yet"}
                description={
                  ar
                    ? "أول ما يفتح محرّك QAIS AI صفقة، بتظهر هون مع كل تفاصيلها."
                    : "Once QAIS AI opens its first trade, it will appear here with full details."
                }
                actionLabel={ar ? "افتح Radar" : "Open Radar"}
                onAction={() => {}}
              />
            </Module>
          </div>
        </Section>
      </main>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={ar ? "تأكيد إغلاق الصفقة" : "Confirm closing trade"}
        description={ar ? "XAUUSD · شراء 0.50" : "XAUUSD · Buy 0.50"}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setModal(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button size="sm" onClick={() => setModal(false)}>
              {ar ? "إغلاق الصفقة" : "Close trade"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1">
          <KeyValue label={ar ? "الدخول" : "Entry"} value="2,398.20" />
          <KeyValue label={ar ? "السعر الحالي" : "Current"} value="2,412.80" tone="profit" />
          <KeyValue label={ar ? "الربح المحقّق" : "Realized P&L"} value="+$730.00" tone="profit" />
          <KeyValue label={ar ? "المدة" : "Duration"} value="4h 12m" mono />
        </div>
      </Modal>
    </div>
  );
}

export default function GalleryClient() {
  return (
    <ToastProvider>
      <Gallery />
    </ToastProvider>
  );
}
