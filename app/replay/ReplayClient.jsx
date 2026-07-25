"use client";
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ASSETS, getAssetByValue, INTERVAL_MAP, INTERVAL_MS } from "@/lib/assets";
import { createClient } from "@/lib/supabase-client";
import { INDICATOR_DEFS, searchIndicators, getIndicatorDef, defaultParamsFor } from "@/lib/indicators";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F2D57E";
const GREEN = "#02C076";
const RED = "#F6465D";
const DEFAULT_COMPARE_HEIGHT = 200; // ارتفاع لوحة المقارنة الافتراضي بالبكسل (قابل للسحب من المستخدم)
// عرض ثابت (بالبكسل) لعمود الأسعار باليمين - لازم يكون نفس القيمة بالشارت الرئيسي
// وشارت المقارنة معاً، وإلا كل شارت (نسخة lightweight-charts منفصلة) بيحسب عرض
// عمود الأسعار تلقائياً حسب عدد خانات السعر تبعه، فمنطقة رسم الشموع ما بتضل
// بنفس المحاذاة بالبكسل بين اللوحتين حتى لو كانت الفترة الزمنية متطابقة 100%
// (هاي كانت سبب مشكلة "آخر شمعة فوق مش طالعة فوق آخر شمعة تحت بالضبط").
const PRICE_SCALE_WIDTH = 78;

/* ===== أدوات مساعدة لمحرك تنفيذ الصفقات (TP/SL) =====
   بنستخدم تسامح نسبي صغير (epsilon) بدل المقارنة المباشرة (<=, >=) عشان
   مشاكل دقة الفاصلة العائمة (floating point) ما تمنع إغلاق صفقة وصلت فعلياً
   لهدفها أو وقف خسارتها (مثلاً 1.19999999999 لازم تتعامل معاملة 1.2 بالظبط). */
function priceTolerance(level) {
  return Math.max(Math.abs(level) * 1e-7, 1e-8);
}
// a <= b مع تسامح
function lteWithTolerance(a, b) {
  return a <= b + priceTolerance(b);
}
// a >= b مع تسامح
function gteWithTolerance(a, b) {
  return a >= b - priceTolerance(b);
}

/* بتتأكد إذا كان عنصر الصفحة الحالي (document.activeElement) هو حقل كتابة
   (input/textarea/select/contenteditable) - عشان اختصارات لوحة المفاتيح
   (Delete/Backspace/Ctrl+Z/Ctrl+Y) ما تتدخل بالكتابة العادية جوا الحقول */
function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
}

/* أدوات الرسم الخطية يلي بتنعمل عليها تقييد الزاوية (Shift) زي تريدنغ فيو -
   بتتقيّد لأقرب زاوية شائعة (0°/45°/90°/135°/180°) طول ما Shift مضغوط */
const LINE_ANGLE_SNAP_TYPES = new Set(["trendline", "ray", "extendedline", "infoline", "angle"]);

const INTERVALS = [
  { value: "1m", label: "1 دقيقة" },
  { value: "5m", label: "5 دقايق" },
  { value: "15m", label: "15 دقيقة" },
  { value: "1h", label: "ساعة" },
  { value: "4h", label: "4 ساعات" },
  { value: "1d", label: "يومي" },
];

/* نفس أرقام rangeDays المضبوطة بـ lib/yahoo-candles.js (INTERVAL_CONFIG) —
   عمق البيانات التاريخي الحقيقي المتاح من يوهو فايننس لكل فريم. مكرّرة هون
   (بدل استيراد ملف سيرفر-فقط جوا كومبوننت كلاينت) عشان نقدر نعطّل بالواجهة
   أي فريم ما بيقدر يوصل لنقطة القص الحالية بالـ Replay، بدل ما نخلّي المستخدم
   يبدّل وبعدين يفاجأ بتوست "أقرب نقطة متاحة" وبيانات غلط الموقع. */
const RANGE_DAYS_BY_INTERVAL = { "1m": 29, "5m": 58, "15m": 58, "1h": 725, "4h": 725, "1d": 3650 };

/* لما يكون عند الأصل رمز Dukascopy (assetInfo.dukascopy)، العمق التاريخي
   الحقيقي المتاح أعمق بكتير من حد يوهو فوق - Dukascopy بترجع تيك-باي-تيك
   من أول ~2003-2010 حسب الأداة، فمنستخدم رقم كبير (~22 سنة) بدل الأرقام
   الضيقة تبع يوهو لأي فريم عند الأصول يلي عندها dukascopy. لو الأداة
   نفسها ما بتوصل لهاد العمق فعلياً، الطلب رح يفشل من lib/dukascopy-candles.js
   وبيرجع تلقائياً لـ Twelve Data/يوهو (نفس السلوك القديم بالضبط) - هون منتحكم
   بس بتعطيل/تفعيل الخيار بالقائمة، مش بمصدر البيانات نفسه. */
const DUKASCOPY_RANGE_DAYS = 8000;
function rangeDaysFor(intervalValue, hasDukascopy) {
  return hasDukascopy ? Math.max(RANGE_DAYS_BY_INTERVAL[intervalValue], DUKASCOPY_RANGE_DAYS) : RANGE_DAYS_BY_INTERVAL[intervalValue];
}

/* سرعات الـ Replay: القيمة هي عدد الشموع بالثانية (1x = شمعة/ثانية ... 10x = 10 شموع/ثانية)
   وبنحولها لـ ms فاصل بين كل شمعة وتالية بمعادلة 1000/السرعة وقت التشغيل الفعلي */
const SPEEDS = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1}x` }));

const CONTEXT_BARS = 60;
const MAX_BARS_OPTIONS = [
  { value: 1000, label: "1000 شمعة" },
  { value: 3000, label: "3000 شمعة" },
  { value: 5000, label: "5000 شمعة (الأقصى)" },
];

/* تنسيق العداد: HH:MM:SS لو الفريم ساعة أو أكتر، وإلا MM:SS */
function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* حدود الشمعة الحالية محسوبة من ساعة الجهاز مباشرة (مش من آخر شمعة رجعها الـ API)
   هيك العداد صحيح دايماً حتى لو مصدر البيانات رجّع شمعة مقفولة كآخر شمعة */
function getCurrentBarWindow(interval) {
  const stepMs = INTERVAL_MS[interval] || 60000;
  const now = Date.now();
  const start = Math.floor(now / stepMs) * stepMs;
  return { start, end: start + stepMs, stepMs, now };
}

/* تصفية أي شمعة فاسدة (وقت/سعر مش رقمي أو تكرار بنفس الوقت) قبل ما توصل لمكتبة الشارت -
   مكتبة lightweight-charts بترفض هيك بيانات وبتعمل throw exception يكسر الصفحة كلها،
   فهاي طبقة حماية إضافية جوا الواجهة نفسها (فوق التصفية اللي صارت بالسيرفر) */
/* تنسيق تاريخ مؤشر الزمن (أسفل الشارت عند تحريك الفأرة) مع إضافة اسم يوم
   الأسبوع بالعربي قبل التاريخ - lightweight-charts افتراضياً بيعرض التاريخ/الوقت
   بس بدون اسم اليوم، وطلبته المستخدمة صراحة. */
const AR_WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatCrosshairTime(time) {
  // time ممكن يوصل كـ UTCTimestamp (رقم ثواني) أو BusinessDay {year,month,day}
  // حسب إعدادات الشارت - منغطي الحالتين.
  let d;
  if (typeof time === "number") {
    d = new Date(time * 1000);
  } else if (time && typeof time === "object" && "year" in time) {
    d = new Date(Date.UTC(time.year, time.month - 1, time.day));
  } else {
    return String(time);
  }
  const dayName = AR_WEEKDAYS[d.getUTCDay()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = SHORT_MONTHS[d.getUTCMonth()];
  const year = String(d.getUTCFullYear()).slice(-2);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dayName} ${day} ${month} '${year}  ${hh}:${mm}`;
}

function sanitizeCandles(list) {
  if (!Array.isArray(list)) return [];
  const clean = list.filter(
    (c) =>
      c &&
      Number.isFinite(c.time) &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close)
  );
  clean.sort((a, b) => a.time - b.time);
  return clean.filter((c, i) => i === 0 || c.time !== clean[i - 1].time);
}

/* ===================== تحويل logical <-> timestamp =====================
   نقاط الرسم (p1/p2/points) مخزّنة بإحداثيات سوق مطلقة: {time (Unix
   timestamp حقيقي), price} - أبداً مش logical index. الـ logical (رقم الشمعة
   على مصفوفة معيّنة) قيمة مشتقة/مؤقتة فقط، لازم تُحسب في كل رسمة (render) من
   الـ time + مصفوفة الشموع المعروضة *حالياً* (شوفي ptToLogical/ptFromLogical
   جوا الكومبوننت تحت). هيك أي تبديل فريم بينعكس صح تلقائياً بدون أي خطوة
   "إعادة إسقاط" منفصلة - ما في نظام logical قديم ينخزّن أو يحتاج تصحيح لاحقاً. */
function logicalToTimeForCandles(logical, candles) {
  if (!candles || candles.length === 0 || !Number.isFinite(logical)) return null;
  const n = candles.length;
  const i0 = Math.floor(logical);
  const frac = logical - i0;
  if (i0 < 0) {
    const t0 = candles[0].time;
    const t1 = candles[1] ? candles[1].time : t0 + 60;
    return t0 + logical * (t1 - t0);
  }
  if (i0 >= n - 1) {
    const tN1 = candles[n - 1].time;
    const tN2 = candles[n - 2] ? candles[n - 2].time : tN1 - 60;
    return tN1 + (logical - (n - 1)) * (tN1 - tN2);
  }
  const t0 = candles[i0].time;
  const t1 = candles[i0 + 1].time;
  return t0 + (t1 - t0) * frac;
}
function timeToLogicalForCandles(time, candles) {
  if (!candles || candles.length === 0 || !Number.isFinite(time)) return 0;
  const n = candles.length;
  if (time <= candles[0].time) {
    const t0 = candles[0].time;
    const t1 = candles[1] ? candles[1].time : t0 + 60;
    const step = t1 - t0 || 1;
    return (time - t0) / step;
  }
  if (time >= candles[n - 1].time) {
    const tN1 = candles[n - 1].time;
    const tN2 = candles[n - 2] ? candles[n - 2].time : tN1 - 60;
    const step = tN1 - tN2 || 1;
    return (n - 1) + (time - tN1) / step;
  }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= time) lo = mid; else hi = mid;
  }
  const t0 = candles[lo].time, t1 = candles[hi].time;
  const frac = t1 > t0 ? (time - t0) / (t1 - t0) : 0;
  return lo + frac;
}
/* ===================== إعدادات ألوان الشارت (تنحفظ محلياً بالمتصفح) ===================== */
// رفعنا رقم النسخة v1 -> v2 قصداً: عشان أي متصفح عنده إعدادات محفوظة قديمة
// (فيها مثلاً priceLineVisible: true من قبل) يرجع ياخذ القيم الافتراضية
// الجديدة تلقائياً بدل ما يضل عالقيم القديمة المخزّنة عنده لحد ما يضغط
// "الافتراضي" يدوياً. هاي أضمن طريقة لأي تغيير مستقبلي بالقيم الافتراضية.
const CHART_SETTINGS_KEY = "qta_chart_settings_v3";
const DEFAULT_CHART_SETTINGS = {
  bg: "#181A20",
  up: GREEN,
  down: RED,
  gridVisible: true,
  gridColor: GOLD,
  crosshairColor: "#758696",
  textColor: "#d1d4dc",
  watermarkText: "",
  scaleMarginTop: 8,
  scaleMarginBottom: 8,
  // ألوان عناصر الصفقة (دخول/هدف/إيقاف/مناطق الربح والخسارة) - قابلة للتخصيص
  // ومستقلة عن باقي ألوان الشارت، وتضل نفسها بعد تغيير الفريم/الزوم/التحريك
  tradeEntryColor: GOLD_LIGHT,
  tradeTpColor: GREEN,
  tradeSlColor: RED,
  tradeProfitZoneColor: GREEN,
  tradeLossZoneColor: RED,
  tradeZoneOpacity: 0.12,
  // رمز (Symbol)
  lastValueLabelVisible: true,
  ohlcVisible: true,
  // خط الحالة (Status line)
  statusShowSymbol: true,
  statusShowInterval: true,
  statusShowValues: true,
  statusShowBg: true,
  // المقاييس والخطوط (Scales & lines)
  autoScale: true,
  // تداول (Trading)
  showTradeButtons: true,
  // تنبيهات (Alerts)
  activeAlertsOnly: true,
  autoHideToast: true,
  // أحداث (Events)
  showEvents: false,
};
function loadChartSettings() {
  if (typeof window === "undefined") return DEFAULT_CHART_SETTINGS;
  try {
    const raw = window.localStorage.getItem(CHART_SETTINGS_KEY);
    if (!raw) return DEFAULT_CHART_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CHART_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}
function saveChartSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHART_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

/* ===================== المؤشرات الفنية المفعّلة (تنحفظ محلياً بالمتصفح) ===================== */
const INDICATORS_KEY = "qta_active_indicators_v1";
function loadActiveIndicators() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INDICATORS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // نتأكد كل مؤشر محفوظ لسا موجود بالسجل (مثلاً بعد تحديث المكتبة) وإلا نتجاهله بهدوء
    return parsed.filter((it) => it && it.instanceId && getIndicatorDef(it.id));
  } catch {
    return [];
  }
}
function saveActiveIndicators(list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INDICATORS_KEY, JSON.stringify(list));
  } catch {}
}

/* قوالب المؤشرات المحفوظة (مجموعات جاهزة تُحمّل بضغطة وحدة) - محلي بالمتصفح */
const INDICATOR_TEMPLATES_KEY = "qta_indicator_templates_v1";
function loadIndicatorTemplates() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INDICATOR_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveIndicatorTemplates(list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INDICATOR_TEMPLATES_KEY, JSON.stringify(list));
  } catch {}
}

/* قوالب أنماط الرسومات (بنفس فكرة تريدنغ فيو: احفظي شكل/لون/سماكة رسمة معيّنة
   باسم زي "FVG.1D" أو "OB"، وبعدين طبّقيه بضغطة وحدة على أي رسمة تانية من
   نفس النوع). محفوظة محلياً بالمتصفح، مقسّمة حسب نوع الرسمة (type) */
const DRAWING_TEMPLATES_KEY = "qta_drawing_style_templates_v1";
function loadDrawingTemplates() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAWING_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveDrawingTemplates(list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAWING_TEMPLATES_KEY, JSON.stringify(list));
  } catch {}
}
/* ===================== آخر إعدادات مستخدمة لكل أداة رسم (Last Used Tool State) =====================
   هاي الميزة مختلفة تمامًا عن "قوالب الرسم" (Templates) اللي فوق:
   - Template: إعداد يحفظه المستخدم يدويًا بإسم، ويطبّقه يدويًا وقتما بده.
   - Last Used Tool State: بتتحدّث تلقائيًا مع كل تعديل مباشر يعمله المستخدم على أي
     خاصية (لون، تعبئة، شفافية، سماكة، نوع خط، حجم نص، امتداد، إلخ)، ولكل أداة رسم
     "ذاكرتها" الخاصة فيها بشكل مستقل عن باقي الأدوات (Rectangle لا يؤثر على Circle، وهكذا).
   - محفوظة محليًا بحساب/متصفح المستخدم (localStorage) فبتضل موجودة حتى لو سكّر
     الموقع وفتحه بعدين، وبتُستخدم تلقائيًا كنقطة بداية لأي رسمة جديدة من نفس النوع،
     إلا إذا كان مضبوط قالب "افتراضي" مثبّت (⭐) لهاد النوع وقتها بياخد الأولوية. */
const DRAWING_LAST_USED_KEY = "qta_drawing_last_used_style_v1";
function loadLastUsedStyles() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DRAWING_LAST_USED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function getLastUsedStyle(type) {
  const all = loadLastUsedStyles();
  return all[type] || null;
}
/* بتدمج التعديل الجديد فوق آخر حالة محفوظة لهاد النوع بالذات وبتحفظه، من غير ما
   تأثر على أي أداة تانية */
function rememberLastUsedStyle(type, patch) {
  if (!type || !patch || typeof window === "undefined") return;
  try {
    const all = loadLastUsedStyles();
    all[type] = { ...(all[type] || {}), ...patch };
    window.localStorage.setItem(DRAWING_LAST_USED_KEY, JSON.stringify(all));
  } catch {}
}
function clearLastUsedStyle(type) {
  if (typeof window === "undefined") return;
  try {
    const all = loadLastUsedStyles();
    delete all[type];
    window.localStorage.setItem(DRAWING_LAST_USED_KEY, JSON.stringify(all));
  } catch {}
}

/* الأنماط الافتراضية لأي رسمة جديدة: بترجع النمط العادي defaultStyleFor مدموج فوقه
   آخر إعدادات استخدمها المستخدم لهاد النوع (Last Used Tool State)، إلا إذا كان في
   قالب معلّم "افتراضي" لهاد النوع (بالضغط على ⭐ بقائمة القوالب)، وهيك القالب
   المثبّت بياخد الأولوية القصوى فوق آخر الإعدادات */
function styleForNewDrawing(type) {
  const base = defaultStyleFor(type);
  if (typeof window === "undefined") return base;
  const lastUsed = getLastUsedStyle(type);
  let style = lastUsed ? { ...base, ...lastUsed } : base;
  try {
    const defName = window.localStorage.getItem(`qta_default_drawing_template_${type}`);
    if (defName) {
      const t = loadDrawingTemplates().find((tt) => tt.type === type && tt.name === defName);
      if (t) style = { ...style, ...t.style };
    }
  } catch {}
  return style;
}

/* ===================== إعدادات لوحة المقارنة (نوع الشارت + ألوان)، تنحفظ محلياً بالمتصفح ===================== */
const COMPARE_SETTINGS_KEY = "qta_compare_chart_settings_v1";
const DEFAULT_COMPARE_SETTINGS = {
  type: "area", // area | line | candles
  lineColor: GOLD_LIGHT,
  fillColor: GOLD_LIGHT,
  lineWidth: 2,
  up: GREEN,
  down: RED,
};
function loadCompareSettings() {
  if (typeof window === "undefined") return DEFAULT_COMPARE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(COMPARE_SETTINGS_KEY);
    if (!raw) return DEFAULT_COMPARE_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_COMPARE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_COMPARE_SETTINGS;
  }
}
function saveCompareSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPARE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}
/* بناء سيريز لوحة المقارنة حسب النوع المختار (منطقة/خط/شموع) وألوانه
   (تحويل اللون لـ rgba بيصير عن طريق hexToRgba المعرّفة تحت بنفس الملف) */
function buildCompareSeries(chart, settings) {
  if (settings.type === "line") {
    return chart.addLineSeries({
      color: settings.lineColor,
      lineWidth: settings.lineWidth,
      priceLineVisible: false,
      lastValueVisible: true,
    });
  }
  if (settings.type === "candles") {
    return chart.addCandlestickSeries({
      upColor: settings.up, downColor: settings.down, borderVisible: false,
      wickUpColor: settings.up, wickDownColor: settings.down,
      priceLineVisible: false, lastValueVisible: true,
    });
  }
  return chart.addAreaSeries({
    lineColor: settings.lineColor,
    topColor: hexToRgba(settings.fillColor, 0.28),
    bottomColor: hexToRgba(settings.fillColor, 0.02),
    lineWidth: settings.lineWidth,
    priceLineVisible: false,
    lastValueVisible: true,
  });
}
/* تجهيز بيانات لوحة المقارنة حسب نوع الشارت المختار (شموع كاملة أو قيمة إغلاق فقط) */
function compareSeriesData(type, candles) {
  if (type === "candles") {
    return candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
  }
  return candles.map((c) => ({ time: c.time, value: c.close }));
}

/* تحويل صفقة الاستعراض التاريخي لصف جدول trades (نفس شكل أداة الباك تيست بالظبط عشان تظهر فيها وبلوحة التحكم) */
function tradeToRow(trade, userId) {
  return {
    user_id: userId,
    asset: trade.asset,
    trade_date: trade.date,
    direction: trade.direction,
    lot: trade.lot,
    entry: trade.entry,
    sl: trade.sl,
    tp: trade.tp,
    result: trade.result,
    setup: trade.setup || null,
    reason: trade.reason || null,
    risk_amount: trade.riskAmount,
    reward_amount: trade.rewardAmount,
    rr: trade.rr,
    risk_percent: trade.riskPercent,
    is_live: trade.isLive,
    price_source: trade.priceSource || null,
    source_symbol: trade.sourceSymbol || null,
  };
}

/* ===================== شارت عشوائي (تدريب أعمى) ===================== */
function generateRandomCandles(count, interval) {
  const stepMs = INTERVAL_MS[interval] || 15 * 60 * 1000;
  let price = 100 + Math.random() * 900;
  const now = Math.floor(Date.now() / 1000);
  const stepSec = Math.floor(stepMs / 1000);
  const startTime = now - count * stepSec;
  const out = [];
  for (let i = 0; i < count; i++) {
    const vol = price * 0.004;
    const open = price;
    const drift = (Math.random() - 0.5) * vol * 2;
    const close = Math.max(0.01, open + drift);
    const high = Math.max(open, close) + Math.random() * vol;
    const low = Math.min(open, close) - Math.random() * vol;
    out.push({ time: startTime + i * stepSec, open, high, low: Math.max(0.01, low), close });
    price = close;
  }
  return out;
}

/* ===================== أيقونات شريط الرسم (SVG نظيفة بستايل تريدنغ فيو) ===================== */
function ToolIcon({ id }) {
  const common = { width: 23, height: 23, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "cursor":
      return (<svg {...common}><path d="M5 3l14 6.5-6 1.7L11 18 5 3z" fill="currentColor" stroke="none" /></svg>);
    case "trendline":
      return (<svg {...common}><circle cx="5" cy="19" r="1.8" /><circle cx="19" cy="5" r="1.8" /><line x1="6.3" y1="17.7" x2="17.7" y2="6.3" /></svg>);
    case "ray":
      return (<svg {...common}><circle cx="5" cy="19" r="1.8" fill="currentColor" stroke="none" /><line x1="6.3" y1="17.7" x2="19" y2="5" /><polyline points="14,5 19,5 19,10" /></svg>);
    case "extendedline":
      return (<svg {...common}><line x1="2" y1="21" x2="22" y2="3" /><circle cx="7" cy="16.5" r="1.6" /><circle cx="17" cy="7.5" r="1.6" /></svg>);
    case "infoline":
      return (<svg {...common}><circle cx="5" cy="19" r="1.8" /><circle cx="19" cy="5" r="1.8" /><line x1="6.3" y1="17.7" x2="17.7" y2="6.3" /><text x="12" y="14" fontSize="7" stroke="none" fill="currentColor">i</text></svg>);
    case "angle":
      return (<svg {...common}><line x1="4" y1="20" x2="20" y2="20" /><line x1="4" y1="20" x2="18" y2="6" /><path d="M9 20a6 6 0 0 1 1.2-3.6" /></svg>);
    case "crossline":
      return (<svg {...common}><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /></svg>);
    case "parallelchannel":
      return (<svg {...common}><line x1="3" y1="18" x2="17" y2="6" /><line x1="7" y1="21" x2="21" y2="9" /></svg>);
    case "hline":
      return (<svg {...common}><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" /></svg>);
    case "hray":
      return (<svg {...common}><circle cx="4" cy="12" r="1.8" fill="currentColor" stroke="none" /><line x1="4" y1="12" x2="20" y2="12" /><polyline points="16,8 20,12 16,16" /></svg>);
    case "vline":
      return (<svg {...common}><line x1="12" y1="3" x2="12" y2="21" /></svg>);
    case "path":
      return (<svg {...common}><polyline points="4,18 9,7 14,15 20,5" /></svg>);
    case "triangle":
      return (<svg {...common}><path d="M12 4l8 16H4z" /></svg>);
    case "arrow":
      return (<svg {...common}><line x1="4" y1="20" x2="19" y2="5" /><polyline points="9,5 19,5 19,15" /></svg>);
    case "rectangle":
      return (<svg {...common}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>);
    case "circle":
      return (<svg {...common}><circle cx="12" cy="12" r="8" /></svg>);
    case "fib":
      return (<svg {...common}><line x1="3" y1="5" x2="21" y2="5" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="14" x2="21" y2="14" /><line x1="3" y1="19" x2="21" y2="19" /></svg>);
    case "fibext":
      return (<svg {...common}><polyline points="4,19 10,7 15,14 21,4" /><line x1="10" y1="7" x2="21" y2="7" strokeDasharray="2,2" /><line x1="15" y1="14" x2="21" y2="14" strokeDasharray="2,2" /><line x1="4" y1="19" x2="21" y2="19" strokeDasharray="2,2" /></svg>);
    case "fibchannel":
      return (<svg {...common}><line x1="2" y1="21" x2="16" y2="4" strokeDasharray="2,2" /><line x1="6" y1="21" x2="20" y2="4" /><line x1="10" y1="21" x2="24" y2="4" strokeDasharray="2,2" /></svg>);
    case "fibtimezone":
      return (<svg {...common}><line x1="4" y1="3" x2="4" y2="21" /><line x1="8" y1="3" x2="8" y2="21" /><line x1="14" y1="3" x2="14" y2="21" /><line x1="22" y1="3" x2="22" y2="21" /></svg>);
    case "gannfan":
      return (<svg {...common}><line x1="3" y1="21" x2="21" y2="3" /><line x1="3" y1="21" x2="21" y2="9" /><line x1="3" y1="21" x2="21" y2="15" /><line x1="3" y1="21" x2="15" y2="21" /></svg>);
    case "pitchfork":
      return (<svg {...common}><line x1="4" y1="20" x2="12" y2="4" /><line x1="12" y1="4" x2="21" y2="10" strokeDasharray="2,2" /><line x1="12" y1="4" x2="21" y2="18" strokeDasharray="2,2" /></svg>);
    case "wave":
      return (<svg {...common}><path d="M4 20l5-14 5 10 6-12" /></svg>);
    case "pricerange":
      return (<svg {...common}><line x1="12" y1="4" x2="12" y2="20" /><polyline points="9,7 12,4 15,7" /><polyline points="9,17 12,20 15,17" /><line x1="7" y1="4" x2="17" y2="4" /><line x1="7" y1="20" x2="17" y2="20" /></svg>);
    case "daterange":
      return (<svg {...common}><line x1="4" y1="12" x2="20" y2="12" /><polyline points="7,9 4,12 7,15" /><polyline points="17,9 20,12 17,15" /><line x1="4" y1="7" x2="4" y2="17" /><line x1="20" y1="7" x2="20" y2="17" /></svg>);
    case "position_long":
      return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 16V8M8.5 11.5L12 8l3.5 3.5" /></svg>);
    case "position_short":
      return (<svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8.5 12.5L12 16l3.5-3.5" /></svg>);
    case "text":
      return (<svg {...common}><path d="M5 5h14M12 5v14" /></svg>);
    case "measure":
      return (<svg {...common}><rect x="3" y="9" width="18" height="6" rx="1" /><line x1="7" y1="9" x2="7" y2="12" /><line x1="11" y1="9" x2="11" y2="12" /><line x1="15" y1="9" x2="15" y2="12" /><line x1="19" y1="9" x2="19" y2="12" /></svg>);
    case "magnet":
      return (<svg {...common}><path d="M7 4v7a5 5 0 0 0 10 0V4" /><path d="M7 4H4v7a8 8 0 0 0 16 0V4h-3" /></svg>);
    case "eye":
      return (<svg {...common}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>);
    case "eyeOff":
      return (<svg {...common}><path d="M3 3l18 18" /><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.2M6.7 6.7C4 8.5 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.9-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>);
    case "trash":
      return (<svg {...common}><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>);
    case "gear":
      return (<svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.7 7.7 0 0 0-1.7-1L15 3h-4l-.4 2.4a7.7 7.7 0 0 0-1.7 1l-2.3-.9-2 3.4L6.6 11a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.8 1.7 1L10 21h4l.4-2.4c.6-.2 1.2-.6 1.7-1l2.3.9 2-3.4z" /></svg>);
    case "undo":
      return (<svg {...common}><path d="M7 8H3V4" /><path d="M3 8a9 9 0 1 1 2.6 8.6" /></svg>);
    case "redo":
      return (<svg {...common}><path d="M17 8h4V4" /><path d="M21 8a9 9 0 1 0-2.6 8.6" /></svg>);
    case "refresh":
      return (<svg {...common}><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" /><path d="M3 21v-5h5" /></svg>);
    case "compare2":
      return (<svg {...common}><path d="M7 3v14M7 17l-3-3M7 17l3-3" /><path d="M17 21V7M17 7l3 3M17 7l-3 3" /></svg>);
    case "indicators2":
      return (<svg {...common}><path d="M4 19V9" /><path d="M11 19V4" /><path d="M18 19v-7" /></svg>);
    case "template2":
      return (<svg {...common}><rect x="3" y="4" width="18" height="16" rx="1.5" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="9" x2="9" y2="20" /></svg>);
    case "plus":
      return (<svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
    case "camera":
      return (<svg {...common}><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>);
    case "resetzoom":
      return (<svg {...common}><path d="M3 3v6h6" /><path d="M21 12A9 9 0 0 0 6 5.3L3 8" /><path d="M21 21v-6h-6" /><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" /></svg>);
    case "fullscreen":
      return (<svg {...common}><path d="M8 3H4v4" /><path d="M16 3h4v4" /><path d="M8 21H4v-4" /><path d="M16 21h4v-4" /></svg>);
    case "fullscreenExit":
      return (<svg {...common}><path d="M4 8V4h4" /><path d="M20 8V4h-4" /><path d="M4 16v4h4" /><path d="M20 16v4h-4" /></svg>);
    case "dice2":
      return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" /></svg>);
    case "scissors2":
      return (<svg {...common}><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><line x1="7.8" y1="7.5" x2="20" y2="19" /><line x1="20" y1="5" x2="7.8" y2="16.5" /></svg>);
    case "checkmark":
      return (<svg {...common}><polyline points="4,13 9,18 20,6" /></svg>);
    case "xmark":
      return (<svg {...common}><line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" /></svg>);
    case "marquee":
      return (<svg {...common}><rect x="4" y="6" width="16" height="12" rx="1" strokeDasharray="3,2.5" /><line x1="4" y1="4" x2="4" y2="8" strokeDasharray="0" /><line x1="20" y1="4" x2="20" y2="8" strokeDasharray="0" /></svg>);
    case "person":
      return (<svg {...common}><circle cx="12" cy="8" r="3.3" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>);
    case "lock":
      return (<svg {...common}><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
    case "unlock":
      return (<svg {...common}><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V7a4 4 0 0 1 7.4-2" /></svg>);
    case "kebab":
      return (<svg {...common}><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" /></svg>);
    case "copy2":
      return (<svg {...common}><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg>);
    case "hexagonEye":
      return (<svg {...common}><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" /><circle cx="12" cy="12" r="2.6" /></svg>);
    case "paintbucket":
      return (<svg {...common}><path d="M3 13l8-8 8.5 8.5a2 2 0 0 1 0 2.8l-4.4 4.4a2 2 0 0 1-2.8 0L3 12.3z" /><path d="M3 13h10" /><path d="M18.5 15.5c.6.9 1.5 2 1.5 3a1.7 1.7 0 0 1-3.4 0c0-1 .9-2.1 1.5-3z" /></svg>);
    case "pencilLine":
      return (<svg {...common}><path d="M4 20l1-4L15.5 5.5a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8 19l-4 1z" /><path d="M13.5 7.5l3 3" /></svg>);
    case "templatePlus":
      return (<svg {...common}><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><path d="M17 14v6M14 17h6" /></svg>);
    case "dragDots":
      return (<svg {...common}><circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" /></svg>);
    default:
      return null;
  }
}

/* عناوين وترتيب أدوات الرسم (مجمّعة زي تريدنغ فيو) */
const TOOL_TITLES = {
  cursor: "مؤشر (تنقل عادي)",
  trendline: "خط اتجاه",
  ray: "شعاع",
  extendedline: "خط ممتد (بالاتجاهين)",
  infoline: "خط معلومات",
  angle: "زاوية الاتجاه",
  hline: "خط أفقي",
  hray: "شعاع أفقي",
  vline: "خط عمودي",
  crossline: "خط متقاطع",
  parallelchannel: "قناة متوازية",
  path: "مسار (نقاط متعددة)",
  triangle: "مثلث",
  arrow: "سهم",
  rectangle: "مستطيل",
  circle: "دائرة",
  fib: "فيبوناتشي (تصحيح)",
  fibext: "فيبوناتشي (امتداد 3 نقاط)",
  fibchannel: "قناة فيبوناتشي",
  fibtimezone: "مناطق فيبوناتشي الزمنية",
  gannfan: "مروحة غان",
  pitchfork: "شوكة أندروز (Pitchfork)",
  wave: "موجة تصحيح إليوت (0،A،B،C)",
  pricerange: "نطاق السعر",
  daterange: "نطاق التاريخ",
  position_long: "مركز شراء",
  position_short: "مركز بيع",
  text: "نص",
  measure: "أداة قياس",
};
const TOOL_GROUPS = [
  ["cursor"],
  ["trendline", "ray", "extendedline", "infoline", "angle", "hline", "hray", "vline", "crossline", "parallelchannel"],
  ["path", "triangle", "arrow", "rectangle", "circle"],
  ["text"],
  ["fib", "fibext", "fibchannel", "fibtimezone"],
  ["gannfan", "pitchfork", "wave", "pricerange", "daterange", "position_long", "position_short"],
  ["measure"],
];
/* التسمية اللي بتظهر تحت أيقونة كل مجموعة بالشريط الجانبي */
const GROUP_LABELS = ["مؤشر", "خطوط", "رسم", "نص", "أدوات فيبوناتشي", "أدوات رسم", "القياسات"];

/* أقسام كل قائمة منسدلة (زي عناوين FIBONACCI / GANN بتريدنغ فيو). المجموعات
   يلي مش موجودة هون بتنعرض كقائمة واحدة بدون عنوان قسم. */
const TOOL_GROUP_SECTIONS = {
  1: [{ title: "خطوط", tools: ["trendline", "ray", "extendedline", "infoline", "angle", "hline", "hray", "vline", "crossline", "parallelchannel"] }],
  2: [{ title: "أشكال", tools: ["path", "triangle", "arrow", "rectangle", "circle"] }],
  4: [{ title: "فيبوناتشي", tools: ["fib", "fibext", "fibchannel", "fibtimezone"] }],
  5: [
    { title: "غان", tools: ["gannfan"] },
    { title: "أخرى", tools: ["pitchfork", "wave"] },
    { title: "نطاقات", tools: ["pricerange", "daterange"] },
    { title: "المراكز", tools: ["position_long", "position_short"] },
  ],
};

/* أنماط افتراضية لكل نوع رسمة (قابلة للتعديل من لوحة الخصائص) */
function defaultStyleFor(type) {
  switch (type) {
    case "trendline":
    case "ray":
      return { color: GOLD_LIGHT, width: 2, extend: "none" };
    case "extendedline":
      return { color: GOLD_LIGHT, width: 1.5, extend: "both" };
    case "infoline":
      return { color: "#4f7cff", width: 1.5, extend: "none" };
    case "angle":
      return { color: "#e0a63c", width: 1.5 };
    case "crossline":
      return { color: GOLD_LIGHT, width: 1, dash: "dashed" };
    case "parallelchannel":
      return { color: GOLD_LIGHT, width: 1.5, fill: true, fillColor: GOLD, fillAlpha: 0.12 };
    case "hline":
      return { color: GOLD_LIGHT, width: 1.5, dash: "dashed" };
    case "hray":
    case "vline":
      return { color: GOLD_LIGHT, width: 1.5, dash: "solid" };
    case "path":
      return { color: GOLD_LIGHT, width: 2, closed: false, fill: false, fillColor: GOLD, fillAlpha: 0.15 };
    case "triangle":
      return { color: GOLD_LIGHT, width: 1.5, closed: true, fill: true, fillColor: GOLD, fillAlpha: 0.15 };
    case "arrow":
      return { color: GOLD_LIGHT, width: 2 };
    case "wave":
      return { color: "#EAECEF", width: 1.5 };
    case "rectangle":
      return {
        color: GOLD_LIGHT, width: 1.5, fill: true, fillColor: GOLD, fillAlpha: 0.15, midline: false, midlineColor: "#4caf50", midlineDash: true,
        textColor: "#e5e5e5", textSize: 13, textBold: false, textItalic: false, textHAlign: "center", textVAlign: "middle",
      };
    case "circle":
      return { color: GOLD_LIGHT, width: 1.5, fill: true, fillColor: GOLD, fillAlpha: 0.18 };
    case "fib":
      return {
        color: GOLD_LIGHT, extend: "none",
        levels: [
          { value: 0, color: "#787b86", enabled: true },
          { value: 0.236, color: "#f23645", enabled: true },
          { value: 0.382, color: "#ff9800", enabled: true },
          { value: 0.5, color: "#4caf50", enabled: true },
          { value: 0.618, color: "#00bcd4", enabled: true },
          { value: 0.786, color: "#2196f3", enabled: true },
          { value: 1, color: "#787b86", enabled: true },
          { value: 1.272, color: "#9c27b0", enabled: false },
          { value: 1.414, color: "#9c27b0", enabled: false },
          { value: 1.618, color: "#e91e63", enabled: false },
          { value: 2, color: "#795548", enabled: false },
          { value: 2.618, color: "#607d8b", enabled: false },
        ],
      };
    case "fibext":
      return {
        color: GOLD_LIGHT, width: 1.3, extend: "right",
        levels: [
          { value: 0, color: "#787b86", enabled: true },
          { value: 0.236, color: "#f23645", enabled: false },
          { value: 0.382, color: "#ff9800", enabled: true },
          { value: 0.5, color: "#4caf50", enabled: true },
          { value: 0.618, color: "#00bcd4", enabled: true },
          { value: 0.786, color: "#2196f3", enabled: false },
          { value: 1, color: "#787b86", enabled: true },
          { value: 1.272, color: "#9c27b0", enabled: true },
          { value: 1.414, color: "#9c27b0", enabled: false },
          { value: 1.618, color: "#e91e63", enabled: true },
          { value: 2, color: "#795548", enabled: false },
          { value: 2.618, color: "#607d8b", enabled: false },
          { value: 3.618, color: "#607d8b", enabled: false },
          { value: 4.236, color: "#607d8b", enabled: false },
        ],
      };
    case "fibchannel":
      return {
        color: GOLD_LIGHT, width: 1.3,
        levels: [
          { value: 0, color: "#787b86", enabled: true },
          { value: 0.236, color: "#f23645", enabled: true },
          { value: 0.382, color: "#ff9800", enabled: true },
          { value: 0.5, color: "#4caf50", enabled: true },
          { value: 0.618, color: "#00bcd4", enabled: true },
          { value: 0.786, color: "#2196f3", enabled: true },
          { value: 1, color: "#787b86", enabled: true },
        ],
      };
    case "fibtimezone":
      return { color: "#4f7cff", width: 1, dash: "dashed" };
    case "gannfan":
      return { color: "#e0a63c", width: 1.2 };
    case "pitchfork":
      return { color: "#4f7cff", width: 1.5 };
    case "pricerange":
      return { color: "#4f7cff", width: 1.5, fill: true, fillColor: "#4f7cff", fillAlpha: 0.2 };
    case "daterange":
      return { color: "#4f7cff", width: 1.5, fill: true, fillColor: "#4f7cff", fillAlpha: 0.2 };
    case "position_long":
    case "position_short":
      return { targetColor: GREEN, stopColor: RED, alpha: 0.3 };
    case "text":
      return { color: GOLD_LIGHT, size: 13 };
    default:
      return { color: GOLD_LIGHT, width: 1.5 };
  }
}

/* أسعار الدخول/الهدف/الوقف لأداة مركز الشراء أو البيع. لو المستخدم سحب مقبض
   الهدف أو الوقف لحاله (d.targetPrice / d.stopPrice)، منستخدم القيمة المحفوظة
   هاي مباشرة، وإلا منحسبها تلقائياً بشكل متماثل حسب المسافة الأصلية بين
   نقطتي الرسم (سلوك افتراضي 1:1 لحد ما يعدّلها المستخدم يدوياً) */
function getPositionLevels(d) {
  const isLong = d.type === "position_long";
  const entryPrice = d.p1.price;
  const priceDist = Math.abs((d.p2 ? d.p2.price : d.p1.price) - d.p1.price);
  const defaultTarget = isLong ? entryPrice + priceDist : entryPrice - priceDist;
  const defaultStop = isLong ? entryPrice - priceDist : entryPrice + priceDist;
  return {
    entryPrice,
    targetPrice: d.targetPrice != null ? d.targetPrice : defaultTarget,
    stopPrice: d.stopPrice != null ? d.stopPrice : defaultStop,
  };
}

/* رسم نص متعدد الأسطر (word-wrap) جوا مستطيل بإحداثيات x,y,w,h، مع محاذاة
   أفقية (يسار/وسط/يمين) وعمودية (أعلى/وسط/أسفل) قابلة للتحكم - بالظبط متل
   لوحة "النص" بأداة المستطيل بتريدنغ فيو */
function drawShapeText(ctx, text, x, y, w, h, style = {}) {
  if (!text) return;
  const size = style.textSize || 13;
  const weight = style.textBold ? "bold" : "normal";
  const italic = style.textItalic ? "italic" : "normal";
  ctx.save();
  ctx.font = `${italic} ${weight} ${size}px sans-serif`;
  ctx.fillStyle = style.textColor || "#e5e5e5";
  const hAlign = style.textHAlign || "center";
  const vAlign = style.textVAlign || "middle";
  const pad = 6;
  const maxWidth = Math.max(10, w - pad * 2);
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(test).width > maxWidth) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  const lineHeight = size * 1.3;
  const totalH = lines.length * lineHeight;
  let startY;
  if (vAlign === "top") startY = y + pad + size;
  else if (vAlign === "bottom") startY = y + h - pad - totalH + size;
  else startY = y + h / 2 - totalH / 2 + size;
  ctx.textAlign = hAlign === "left" ? "left" : hAlign === "right" ? "right" : "center";
  const tx = hAlign === "left" ? x + pad : hAlign === "right" ? x + w - pad : x + w / 2;
  lines.forEach((line, i) => ctx.fillText(line, tx, startY + i * lineHeight));
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(201,162,75,${alpha})`;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export default function ReplayClient({ userId }) {

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  /* ===================== أداة المؤشرات الفنية ===================== */
  // activeIndicators: [{ instanceId, id, params }]. بتنحفظ محلياً بالمتصفح
  // زي إعدادات الألوان، عشان تضل موجودة لما ترجعي تفتحي الصفحة.
  const [activeIndicators, setActiveIndicators] = useState([]);
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const [indicatorSearch, setIndicatorSearch] = useState("");
  // instanceId المؤشر يلي فاتحة قائمته السريعة حالياً (عين/إعدادات/حذف) - زي الصورة المرجعية
  const [indicatorQuickMenuFor, setIndicatorQuickMenuFor] = useState(null);
  // instanceId المؤشر يلي فاتحة نافذة إعداداته الكاملة (الظهور/نمط/مدخلات)
  const [indicatorSettingsFor, setIndicatorSettingsFor] = useState(null);
  const [indicatorSettingsTab, setIndicatorSettingsTab] = useState("visibility"); // visibility | style | inputs
  const [templatesPanelOpen, setTemplatesPanelOpen] = useState(false);

  /* ===== وضع تسجيل تمارين SMC+ICT (Admin Practice Mode) ===== */
  const [isAdmin, setIsAdmin] = useState(false);
  const [practicePanelOpen, setPracticePanelOpen] = useState(false);
  const [drawingsListTick, setDrawingsListTick] = useState(0); // نجبر تحديث القائمة بعد كل رسمة
  const [drawingRoles, setDrawingRoles] = useState({}); // { [drawingId]: { role, price_tolerance, candle_tolerance, weight, notes } }
  const [scenarioForm, setScenarioForm] = useState({ title: "", description: "", difficulty: "medium" });
  const [savingScenario, setSavingScenario] = useState(false);
  const [scenarioSaveToast, setScenarioSaveToast] = useState("");
  // instanceId -> { def, series: { [lineKey]: ISeriesApi } }
  const indicatorSeriesRef = useRef(new Map());
  // مرآة دايماً محدّثة لـ activeIndicators، عشان أي كود جوا closure قديم
  // (متل إنشاء الشارت اللي بياخد وقت بسبب dynamic import) يقرأ آخر قيمة فعلية
  const activeIndicatorsRef = useRef([]);
  useEffect(() => { activeIndicatorsRef.current = activeIndicators; }, [activeIndicators]);

  const [mode, setMode] = useState("live"); // "live" | "training"
  const [randomChart, setRandomChart] = useState(false);

  const [assetValue, setAssetValue] = useState("XAUUSD");
  // بتتحدث كل ما نجيب شموع جديدة: بتقول فعلياً أي رمز يوهو استُخدم (سبوت أو
  // عقد آجل احتياطي) - شوفي التعليق بأول lib/assets.js لسبب وجود هالمنطق.
  const dataSourceRef = useRef({ symbol: null, usedFallback: false, provider: "yahoo" });
  const [usedFuturesApprox, setUsedFuturesApprox] = useState(false);
  const [interval, setIntervalValue] = useState("15m");
  const [speed, setSpeed] = useState(3); // 3x = 3 شموع/ثانية (قيمة افتراضية معقولة)
  // مرفوع لـ 20000 (متزامن مع الحد الأقصى الجديد بـ lib/yahoo-candles.js) عشان
  // فريمات زي الساعة توصل لنفس عمق التاريخ يلي فريم الـ 4 ساعات بيوصله (شوفي
  // الشرح بـ lib/yahoo-candles.js)
  const [maxBars, setMaxBars] = useState(20000);

  // فتح الشارت مباشرة على رمز معيّن جاي من صفحة تانية (زر "افتح الشارت" برادار QAIS مثلاً)
  const radarSearchParams = useSearchParams();
  useEffect(() => {
    const wanted = radarSearchParams.get("asset");
    if (wanted && getAssetByValue(wanted)?.yahoo) {
      setAssetValue(wanted);
      setMode("live");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const [allCandles, setAllCandles] = useState([]);
  const [revealCount, setRevealCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const [countdown, setCountdown] = useState("");
  const [countdownProgress, setCountdownProgress] = useState(0);
  const [liveLastPrice, setLiveLastPrice] = useState(null);
  const [priceDir, setPriceDir] = useState(0); // 1 صعود / -1 هبوط / 0 محايد
  const prevPriceRef = useRef(null);

  function updateLivePrice(p) {
    if (prevPriceRef.current != null) {
      if (p > prevPriceRef.current) setPriceDir(1);
      else if (p < prevPriceRef.current) setPriceDir(-1);
    }
    prevPriceRef.current = p;
    setLiveLastPrice(p);
    checkOpenPositionsRef.current?.(p);
  }

  const [cutMode, setCutMode] = useState(false);
  const cutModeRef = useRef(false);
  useEffect(() => { cutModeRef.current = cutMode; }, [cutMode]);
  /* ===== أداة القص الجديدة (تجربة سحب كاملة زي تريدنغ فيو) =====
     cutSubMode: أي وضع فرعي فعّال حالياً جوا وضع القص:
       - "select": سحب لتحديد منطقة جديدة من الصفر
       - "move": سحب المنطقة كلها (تحريك الحافتين معاً بنفس المسافة)
       - "edit-edges": سحب حافة وحدة (يمين أو يسار) لحالها
     cutRegion: المنطقة "قيد التعديل" حالياً (لسا ما انطبقت) - بإحداثيات
       logical (نسبةً لمصفوفة الشموع الحالية، متل نقاط الرسومات بالظبط).
     appliedCutRegion: آخر منطقة انطبقت فعلياً - محفوظة بالوقت الحقيقي
       (fromTime/toTime) مش logical، عشان تضل صحيحة تلقائياً حتى لو تغيّر
       الفريم أو تحدّثت مصفوفة الشموع (بدون أي حاجة لإعادة إسقاط يدوية،
       بعكس الرسومات، لأننا منحسب مكانها من وقتها الحقيقي مباشرة بكل رسمة). */
  const [cutSubMode, setCutSubMode] = useState("select");
  const cutSubModeRef = useRef("select");
  useEffect(() => { cutSubModeRef.current = cutSubMode; }, [cutSubMode]);
  const [cutRegion, setCutRegion] = useState(null); // {fromLogical, toLogical} | null
  const cutRegionRef = useRef(null);
  useEffect(() => { cutRegionRef.current = cutRegion; }, [cutRegion]);
  const [appliedCutRegion, setAppliedCutRegion] = useState(null); // {fromTime, toTime} | null
  const appliedCutRegionRef = useRef(null);
  useEffect(() => { appliedCutRegionRef.current = appliedCutRegion; }, [appliedCutRegion]);
  const cutDragRef = useRef(null); // {mode:"select"|"move"|"edge", edge?, startLogical, origFrom, origTo}
  // إعدادات أداة القص (لوحة الإعدادات بالصورة المرجعية)
  const [cutSettingsOpen, setCutSettingsOpen] = useState(false);
  const [cutShowRegion, setCutShowRegion] = useState(true);
  const cutShowRegionRef = useRef(true);
  useEffect(() => { cutShowRegionRef.current = cutShowRegion; }, [cutShowRegion]);
  const [cutDimOutside, setCutDimOutside] = useState(true);
  const cutDimOutsideRef = useRef(true);
  useEffect(() => { cutDimOutsideRef.current = cutDimOutside; }, [cutDimOutside]);
  const [cutAutoSave, setCutAutoSave] = useState(false);
  const [cutPrecision, setCutPrecision] = useState("pixel"); // "pixel" (محاذاة لكامل الشمعة) | "free" (موضع حر)
  // نسخة State من نقطة قص الـ Replay الحالية (currentTimestamp بالـ ref تحت) —
  // بس عشان نقدر نستخدمها بالـ render (تعطيل خيارات الفريم بالـ select)،
  // لأن الـ ref لحاله ما بيعمل re-render.
  const [replayCutTs, setReplayCutTs] = useState(null);
  /* ===== حالة الـ Replay (ReplayState) - مستقلة تماماً عن الفريم الحالي =====
     isActive: هل في Replay/تدريب شغال فعلياً (نقطة قص أو بداية عشوائية).
     anchorTimestamp: الوقت الحقيقي لنقطة "القص" الأصلية (تنعيّن مرة وحدة، وما
       بتتغيّر إلا بعملية قص جديدة أو تحميل سوق مختلف بالكامل).
     currentTimestamp: آخر وقت حقيقي وصله الـ Replay فعلياً (بيتحرك مع كل تقدّم:
       Play، خطوة يدوية، أو حتى بعد تحويله لفريم جديد).
     originalTimeframe: الفريم يلي اتعمل عليه القص أساساً (معلومة توثيقية بس). */
  const replayStateRef = useRef({ isActive: false, anchorTimestamp: null, currentTimestamp: null, originalTimeframe: null });
  // لما نضطر نرجع لـ CONTEXT_BARS احتياطي (نقطة القص الأصلية مش متوفرة بالفريم
  // الجديد)، ما بدنا الـ useEffect تحت (اللي بيزامن currentTimestamp مع آخر
  // شمعة مكشوفة) "يصدّق" هاد الموضع المؤقت ويكتب فوق نقطة القص الحقيقية بشكل
  // دائم. هاد الفلاغ بيخلي الـ useEffect يتخطى مرة وحدة بس (أول مرة بعد
  // الاحتياطي)، فنقطة القص الأصلية تضل محفوظة وترجع صح لو رجعنا لفريم بيوصلها.
  const suppressAnchorSyncOnceRef = useRef(false);
  const cutHoverLogicalRef = useRef(null); // موقع تحويم الماوس أثناء اختيار نقطة بداية الـ Replay (لمعاينة Blur/شعاع حي)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartWrapperRef = useRef(null);
  const headerRef = useRef(null);

  const playTimerRef = useRef(null);
  const livePollRef = useRef(null);
  // عداد فشل التحديث اللايف المتتالي - لو تكرر الفشل (مثلاً تقييد مؤقت من يوهو)
  // منجبر إعادة تحميل كاملة بدل ما نضل نحاول تحديثات جزئية فاشلة للأبد بصمت
  const livePollFailCountRef = useRef(0);
  const countdownTickRef = useRef(null);
  const forminCandleStartRef = useRef(null);

  /* ===================== أدوات الرسم (تريدنغ فيو ستايل) ===================== */
  const overlayCanvasRef = useRef(null);
  const chartAreaRef = useRef(null);
  const [activeTool, setActiveTool] = useState("cursor");
  const [magnetOn, setMagnetOn] = useState(false);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [allDrawingsLocked, setAllDrawingsLocked] = useState(false);
  const allDrawingsLockedRef = useRef(false);
  const activeToolRef = useRef("cursor");
  const magnetRef = useRef(false);
  /* Shift مضغوط حالياً؟ - بتعطّل المغناطيس مؤقتاً وبتفعّل تقييد زاوية الخطوط،
     وبترجع تلقائياً عادي أول ما يترفع الزر (بدون ما تغيّر إعداد Magnet نفسه) */
  const shiftPressedRef = useRef(false);
  /* قائمة منسدلة لكل مجموعة أدوات (زي تريدنغ فيو): ضغطة عالسهم بتفتح قائمة
     بأسماء كل الأدوات جوا المجموعة، وبتتذكر آخر أداة مختارة من كل مجموعة */
  const [openToolGroup, setOpenToolGroup] = useState(null);
  const [toolGroupDefault, setToolGroupDefault] = useState({});
  const groupBtnRefs = useRef({});
  /* ===== شريط الأدوات المفضلة: قائمة بمعرّفات الأدوات يلي المستخدم فضّلها
     (زي نجمة "Add to Favorites" بتريدنغ فيو)، محفوظة بالـ localStorage
     عشان تضل موجودة حتى بعد تحديث الصفحة ===== */
  const [favoriteTools, setFavoriteTools] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("qta_favorite_tools");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setFavoriteTools(parsed);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("qta_favorite_tools", JSON.stringify(favoriteTools)); } catch {}
  }, [favoriteTools]);
  function toggleFavoriteTool(id) {
    setFavoriteTools((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }
  const drawingsVisibleRef = useRef(true);
  // [{id, type, p1:{time,price}, p2?, points?, text?, style}]
  // مهم جداً: p1/p2/points بتخزّن "time" (Unix timestamp حقيقي) + "price" -
  // إحداثيات سوق مطلقة، مش "logical" (رقم شمعة على مصفوفة معيّنة). الـ logical
  // بيختلف تماماً بين الفريمات (نفس التاريخ ممكن يكون شمعة رقم 40 بفريم الساعة
  // وشمعة رقم 3 بفريم اليوم) وحتى بين تحميلتين لنفس الفريم - فتخزينه كمصدر
  // حقيقة وحيد هو اللي كان يسبب "قفز" نقاط الرسم لما تتبدّلي فريم. الـ logical
  // لأي نقطة رسم لازم ينحسب "live" وقت كل رسمة (render) من الـ timestamp
  // المخزّن + مصفوفة الشموع المعروضة حالياً بس (شوفي ptLogical تحت) - أبداً ما
  // بينخزّن أو يُحسب مرة وحدة بس عند تبديل الفريم زي كان قبل (النظام القديم
  // reprojectDrawing/pendingReprojectRef انحذف بالكامل: كان "ترقيع" بيشتغل
  // بس بمسار كود واحد محدد وبينكسر بأي مسار تاني).
  const drawingsRef = useRef([]);
  const drawStateRef = useRef(null); // الرسمة الجارية حالياً (سحب نقطتين)
  const isDrawingRef = useRef(false);
  const visibleCandlesRef = useRef([]);
  const pathPointsRef = useRef([]); // نقاط أداة المسار/الموجة أثناء الرسم
  const liveCursorRef = useRef(null); // موقع الماوس الحالي (لمعاينة المسار قبل التثبيت)
  const dragStateRef = useRef(null); // سحب/تحريك رسمة موجودة بوضع المؤشر: {mode:"move"|"handle", id, key?, lastLogical?, lastPrice?}
  const intervalRef = useRef(interval);
  const countdownRef = useRef("");
  const symbolLabelRef = useRef("");
  const ohlcLineRef = useRef(null);
  const ohlcORef = useRef(null);
  const ohlcHRef = useRef(null);
  const ohlcLRef = useRef(null);
  const ohlcCRef = useRef(null);
  const ohlcHoverActiveRef = useRef(false);
  const priceTagRef = useRef(null);

  // لوحة خصائص الرسمة المحددة
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  /* ===== شريط أدوات سريع يطلع فوق أي رسمة لما تنكبس عليها كبسة وحدة
     (زي تريدنغ فيو: لون/سماكة/قفل/نسخ/حذف بدون ما تفتحي اللوحة الكاملة) ===== */
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);
  const selectedIdRef = useRef(null);
  const [selectionRenderTick, setSelectionRenderTick] = useState(0);
  const selectionToolbarRef = useRef(null);
  /* موضع الشريط العائم (مركز أفقي X، حافة علوية Y) - مستقل تماماً عن الرسمة
     المختارة. أول ما يظهر الشريط منحسب موضع ابتدائي معقول قريب من أول رسمة،
     وبعدها بيضل بمكانه لحد ما المستخدم نفسه يسحبه لمكان تاني (زي تريدنغ فيو:
     تغيير التحديد بيحدّث أدوات الشريط بس، بدون ما يحرّك الشريط نفسه) */
  const toolbarPosRef = useRef(null);
  const [drawingTemplatesMenuOpen, setDrawingTemplatesMenuOpen] = useState(false);
  const [textPopoverOpen, setTextPopoverOpen] = useState(false);
  const [textPopoverValue, setTextPopoverValue] = useState("");
  /* ===== تراجع/إعادة (Undo/Redo) على مستوى الرسومات - Ctrl+Z / Ctrl+Y =====
     كل عملية "تُحدث" على الرسومات (إنشاء/حذف/نقل/تعديل خصائص) بتحفظ نسخة
     من الحالة قبلها هون قبل ما تصير، عشان نقدر نرجع لها بالضبط */
  const historyRef = useRef([]);
  const redoStackRef = useRef([]);
  const HISTORY_LIMIT = 100;

  /* ===== مقارنة الرموز (شارت مقسوم) + تكبير أي جزء بضغطتين ماوس ===== */
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSymbol, setCompareSymbol] = useState("SPX500");
  const [compareCandles, setCompareCandles] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [maximizedPane, setMaximizedPane] = useState(null); // null | "main" | "compare"
  const compareContainerRef = useRef(null);
  const compareChartRef = useRef(null);
  const compareSeriesRef = useRef(null);
  const compareOpenRef = useRef(false);
  const maximizedPaneRef = useRef(null);
  const [compareHeightPx, setCompareHeightPx] = useState(DEFAULT_COMPARE_HEIGHT);
  const compareHeightPxRef = useRef(DEFAULT_COMPARE_HEIGHT);
  const mainPaneRef = useRef(null);
  const comparePaneRef = useRef(null);
  const compareCandlesRef = useRef([]);
  const crosshairSyncingRef = useRef(false);
  const rangeSyncingRef = useRef(false);

  /* إعدادات لوحة المقارنة (نوع الشارت وألوانه) + نافذتها الخاصة */
  const [compareSettings, setCompareSettings] = useState(DEFAULT_COMPARE_SETTINGS);
  const [compareSettingsOpen, setCompareSettingsOpen] = useState(false);

  /* إعدادات ألوان الشارت (خلفية + شموع صعود/هبوط) + قائمة الكليك يمين + نافذة الإعدادات */
  const [chartSettings, setChartSettings] = useState(DEFAULT_CHART_SETTINGS);
  // بعض معالِجات الشارت (subscribeCrosshairMove/subscribeVisibleLogicalRangeChange) بتنعمل
  // مرة وحدة بس عند إنشاء الشارت، فبتضل ماسكة نسخة قديمة (Stale) من drawOverlay. عشان ألوان
  // الصفقة (Trade Colors) تنعكس فوراً حتى بعد أول تغيير، منقرأها هون من Ref دايماً محدّث
  const chartSettingsRef = useRef(chartSettings);
  useEffect(() => { chartSettingsRef.current = chartSettings; }, [chartSettings]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("symbol");
  const [contextMenu, setContextMenu] = useState(null); // { x, y, price }

  /* ===== ربط أزرار الشراء/البيع الفوري ببرنامج الباك تيست ===== */
  const supabase = useRef(createClient()).current;
  const [accountBalance, setAccountBalance] = useState(3000);
  const [pendingTrade, setPendingTrade] = useState(null); // {direction, entry, lot, tpId, slId, asset}
  const [tradeLot, setTradeLot] = useState("0.01");
  const [tradeReason, setTradeReason] = useState("");
  const [savingTrade, setSavingTrade] = useState(false);
  const [tradeToast, setTradeToast] = useState("");
  const [dragTick, setDragTick] = useState(0);
  /* لوحة الصفقة المفتوحة (TP/SL) بتحتاج re-render فعلي وهي عم تنسحب عشان
     الأرقام بالبانل تتحدث حية، بس استدعاء setState مباشرة بكل mousemove خام
     (يلي ممكن يصير أسرع من 60 مرة بالثانية بفئران عالية الدقة) كان يفرض
     re-render إضافي زايد عن رسمة الكانفس نفسها = تقطيع محسوس. هلق منجمّعها
     لتحديث وحيد بالحد الأقصى لكل فريم شاشة، بنفس فلسفة scheduleDraw فوق. */
  const dragTickPendingRef = useRef(false);
  function scheduleDragTickBump() {
    if (dragTickPendingRef.current) return;
    dragTickPendingRef.current = true;
    requestAnimationFrame(() => {
      dragTickPendingRef.current = false;
      setDragTick((t) => t + 1);
    });
  }
  const openPositionsRef = useRef([]); // [{dbId, direction, entry, sl, tp, lot, riskAmount, rewardAmount, asset}]
  const [openPositionsList, setOpenPositionsList] = useState([]); // نسخة "تفاعلية" من openPositionsRef عشان نقدر نعرضها ونعدلها بلوحة
  const checkOpenPositionsRef = useRef(null);
  const pendingTradeRef = useRef(null);
  /* نصوص الحقول الرقمية (دخول/هدف/إيقاف) بلوحة تأكيد الصفقة الفورية - عشان تنكتب بحرية
     وتتزامن لحظياً مع الخطوط المسحوبة عالشارت وبالعكس */
  const [entryText, setEntryText] = useState("");
  const [tpText, setTpText] = useState("");
  const [slText, setSlText] = useState("");
  const entryFocusedRef = useRef(false);
  const tpFocusedRef = useRef(false);
  const slFocusedRef = useRef(false);
  /* نفس الفكرة بس لتعديل هدف/إيقاف صفقة مفتوحة (بعد التأكيد) */
  const [openPosEdits, setOpenPosEdits] = useState({}); // { [dbId]: { tp: "..", sl: ".." } }
  const openPosFocusRef = useRef({}); // { [dbId+"_tp"]: true }

  useEffect(() => {
    pendingTradeRef.current = pendingTrade;
  }, [pendingTrade]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    supabase.from("profiles").select("backtest_balance").eq("id", userId).single().then(({ data }) => {
      if (active && data?.backtest_balance != null) setAccountBalance(Number(data.backtest_balance));
    });
    return () => { active = false; };
  }, [supabase, userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    supabase.from("profiles").select("role").eq("id", userId).single().then(({ data }) => {
      if (active) setIsAdmin(data?.role === "admin");
    });
    return () => { active = false; };
  }, [supabase, userId]);

  useEffect(() => {
    if (!tradeToast || chartSettings.autoHideToast === false) return;
    const t = setTimeout(() => setTradeToast(""), 3500);
    return () => clearTimeout(t);
  }, [tradeToast, chartSettings.autoHideToast]);

  /* تحميل إعدادات الألوان المحفوظة بعد أول رندر عالمتصفح (تفادي مشاكل الـ SSR) */
  useEffect(() => {
    setChartSettings(loadChartSettings());
    setCompareSettings(loadCompareSettings());
    setActiveIndicators(loadActiveIndicators());
  }, []);

  /* أي تغيير بلائحة المؤشرات المفعّلة: نحفظها بالمتصفح فوراً */
  useEffect(() => {
    saveActiveIndicators(activeIndicators);
  }, [activeIndicators]);

  /* أي تغيير بالإعدادات: تطبيق فوري على الشارت + حفظ بالمتصفح (وتطبيق نفس لون الخلفية على لوحة المقارنة لو مفتوحة) */
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    chartRef.current.applyOptions({
      layout: { background: { color: chartSettings.bg }, textColor: chartSettings.textColor || "#d1d4dc" },
      grid: {
        vertLines: { color: hexToRgba(chartSettings.gridColor, 0.05), visible: chartSettings.gridVisible },
        horzLines: { color: hexToRgba(chartSettings.gridColor, 0.05), visible: chartSettings.gridVisible },
      },
      watermark: chartSettings.watermarkText
        ? { visible: true, text: chartSettings.watermarkText, color: "rgba(201,162,75,0.12)", fontSize: 48, horzAlign: "center", vertAlign: "center" }
        : { visible: false },
      rightPriceScale: {
        scaleMargins: { top: (chartSettings.scaleMarginTop ?? 8) / 100, bottom: (chartSettings.scaleMarginBottom ?? 8) / 100 },
        autoScale: chartSettings.autoScale !== false,
        // عرض ثابت لعمود الأسعار (لازم يطابق نفس القيمة بشارت المقارنة تماماً)،
        // عشان منطقة رسم الشموع تضل نفس المحاذاة بالبكسل بين الشارتين بغض النظر
        // عن عدد خانات السعر (مثلاً XAUUSD أربع خانات وNAS100 خمس خانات) - لو
        // تركنا العرض تلقائي كل شارت بياخد عرض مختلف وآخر شمعة فوق ما بتطابق
        // آخر شمعة تحت بالضبط حتى لو نفس التوقيت تماماً.
        minimumWidth: PRICE_SCALE_WIDTH,
      },
      crosshair: {
        vertLine: { color: chartSettings.crosshairColor },
        horzLine: { color: chartSettings.crosshairColor },
      },
    });
    seriesRef.current.applyOptions({
      upColor: chartSettings.up, downColor: chartSettings.down,
      wickUpColor: chartSettings.up, wickDownColor: chartSettings.down,
      lastValueVisible: chartSettings.lastValueLabelVisible !== false,
      // هاد الخط (priceLine) هو سبب "الشحطات الصغيرة" بعد آخر شمعة - تم إلغاؤه
      // نهائياً وبشكل ثابت، مش مرتبط بإعداد قابل للتغيير عشان ما يرجع يظهر
      // أبداً بأي حالة (حتى لو في إعدادات قديمة محفوظة بالمتصفح).
      priceLineVisible: false,
    });
    if (compareChartRef.current) {
      compareChartRef.current.applyOptions({
        layout: { background: { color: chartSettings.bg }, textColor: chartSettings.textColor || "#d1d4dc" },
        grid: {
          vertLines: { color: hexToRgba(chartSettings.gridColor, 0.05), visible: chartSettings.gridVisible },
          horzLines: { color: hexToRgba(chartSettings.gridColor, 0.05), visible: chartSettings.gridVisible },
        },
        crosshair: {
          vertLine: { color: chartSettings.crosshairColor },
          horzLine: { color: chartSettings.crosshairColor },
        },
      });
    }
    saveChartSettings(chartSettings);
    applyIndicatorPaneMargins();
    scheduleDraw();
  }, [chartSettings]);

  /* ===================== منطق أداة المؤشرات الفنية ===================== */

  /* بترسم كل خطوط المؤشر مجدداً من فوق صفر الشموع المعروضة حالياً - بتنستدعى
     لما تتحدث بيانات الشارت (تيك حي/خطوة تدريب/تحميل جديد) أو لما ينضاف/يتعدّل مؤشر */
  function recalcAllIndicatorData(candles) {
    const list = candles || visibleCandlesRef.current;
    if (!list || list.length === 0) return;
    activeIndicatorsRef.current.forEach((it) => {
      const def = getIndicatorDef(it.id);
      const entry = indicatorSeriesRef.current.get(it.instanceId);
      if (!def || !entry) return;
      try {
        const result = def.calc(list, it.params || defaultParamsFor(def));
        def.lines.forEach((line) => {
          const s = entry.series[line.key];
          if (!s) return;
          s.setData(result[line.key] || []);
        });
      } catch {
        // مؤشر فشل حسابه (بيانات غير كافية لسا، مثلاً أول ما يضاف قبل تحميل الشموع) - نتجاهله بهدوء
      }
    });
  }

  /* بترتب اللوحات عمودياً: السعر فوق، وتحته لوحة مستقلة لكل مؤشر "oscillator" مفعّل
     (RSI/MACD...الخ)، كل وحدة إلها محور سعر خاص فيها بحيث تنحسب تلقائياً بمعزل عن السعر */
  function applyIndicatorPaneMargins() {
    const chart = chartRef.current;
    if (!chart) return;
    const oscInstances = activeIndicatorsRef.current.filter((it) => getIndicatorDef(it.id)?.type === "oscillator");
    const n = oscInstances.length;
    const regionBottom = Math.min(0.62, n * 0.17);
    try {
      chart.priceScale("right").applyOptions({
        scaleMargins: {
          top: (chartSettings.scaleMarginTop ?? 8) / 100,
          bottom: n > 0 ? regionBottom + 0.03 : (chartSettings.scaleMarginBottom ?? 8) / 100,
        },
      });
    } catch {}
    const paneH = n > 0 ? regionBottom / n : 0;
    oscInstances.forEach((it, i) => {
      const start = (1 - regionBottom) + i * paneH;
      const end = start + paneH * 0.84; // فجوة صغيرة بين كل لوحة والتانية
      try {
        chart.priceScale(`osc-${it.instanceId}`).applyOptions({
          scaleMargins: { top: start, bottom: Math.max(0, 1 - end) },
          borderVisible: false,
        });
      } catch {}
    });
  }

  /* تزامن كامل بين activeIndicators (State) وسيريز lightweight-charts الفعلية على
     الشارت: بتنشئ أي مؤشر ناقص، بتحذف أي مؤشر انشال، وبتحدّث ترتيب اللوحات */
  function syncIndicatorSeries() {
    const chart = chartRef.current;
    const map = indicatorSeriesRef.current;
    if (!chart) return;
    const activeIds = new Set(activeIndicatorsRef.current.map((it) => it.instanceId));
    for (const [instanceId, entry] of Array.from(map.entries())) {
      if (!activeIds.has(instanceId)) {
        Object.values(entry.series).forEach((s) => { try { chart.removeSeries(s); } catch {} });
        map.delete(instanceId);
      }
    }
    activeIndicatorsRef.current.forEach((it) => {
      if (map.has(it.instanceId)) return;
      const def = getIndicatorDef(it.id);
      if (!def) return;
      const scaleId = def.type === "oscillator" ? `osc-${it.instanceId}` : "right";
      const isVisible = it.style?.visible !== false;
      const series = {};
      def.lines.forEach((line) => {
        try {
          series[line.key] = line.isHistogram
            ? chart.addHistogramSeries({
                color: effectiveLineColor(it, line), priceScaleId: scaleId,
                priceLineVisible: false, lastValueVisible: false, base: 0, visible: isVisible,
              })
            : chart.addLineSeries({
                color: effectiveLineColor(it, line), lineWidth: effectiveLineWidth(it, line), priceScaleId: scaleId,
                priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, visible: isVisible,
              });
        } catch {}
      });
      map.set(it.instanceId, { def, series });
    });
    // نحدّث لون/سماكة/ظهور أي سيريز موجودة أصلاً كل مرة (مش بس وقت إنشائها) عشان
    // تغيير الستايل من نافذة الإعدادات ينطبق فوراً بدون ما نهدم ونعيد بناء السيريز
    activeIndicatorsRef.current.forEach((it) => {
      const entry = map.get(it.instanceId);
      if (!entry) return;
      const isVisible = it.style?.visible !== false;
      entry.def.lines.forEach((line) => {
        const s = entry.series[line.key];
        if (!s) return;
        try { s.applyOptions({ color: effectiveLineColor(it, line), lineWidth: effectiveLineWidth(it, line), visible: isVisible }); } catch {}
      });
    });
    applyIndicatorPaneMargins();
    recalcAllIndicatorData();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { syncIndicatorSeries(); }, [activeIndicators]);

  /* بتنعاد كل سيريز المؤشرات المفعّلة من الصفر - لازم تنستدعى كل مرة الشارت نفسه
     ينهدم ويتبنى من جديد (تبديل أصل/فريم...الخ)، لأن السيريز القديمة راحت مع الشارت القديم */
  function rebuildIndicatorSeries() {
    indicatorSeriesRef.current.clear();
    syncIndicatorSeries();
  }

  function addIndicator(defId) {
    const def = getIndicatorDef(defId);
    if (!def) return;
    const instanceId = `${defId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setActiveIndicators((prev) => [...prev, { instanceId, id: defId, params: defaultParamsFor(def), style: { visible: true, colors: {}, widths: {} } }]);
  }
  function removeIndicator(instanceId) {
    setActiveIndicators((prev) => prev.filter((it) => it.instanceId !== instanceId));
    if (indicatorQuickMenuFor === instanceId) setIndicatorQuickMenuFor(null);
    if (indicatorSettingsFor === instanceId) setIndicatorSettingsFor(null);
  }
  function updateIndicatorParam(instanceId, key, value) {
    setActiveIndicators((prev) => prev.map((it) => (it.instanceId === instanceId ? { ...it, params: { ...it.params, [key]: value } } : it)));
    // نحدّث الرسم فوراً بدون انتظار دورة رندر تانية
    setTimeout(() => recalcAllIndicatorData(), 0);
  }
  /* ===== إعدادات الشكل/الظهور لكل مؤشر مفعّل (تبويبات: الظهور / نمط / مدخلات) ===== */
  function toggleIndicatorVisible(instanceId) {
    setActiveIndicators((prev) => prev.map((it) => {
      if (it.instanceId !== instanceId) return it;
      const style = it.style || { visible: true, colors: {}, widths: {} };
      return { ...it, style: { ...style, visible: style.visible === false ? true : false } };
    }));
  }
  function updateIndicatorLineColor(instanceId, lineKey, color) {
    setActiveIndicators((prev) => prev.map((it) => {
      if (it.instanceId !== instanceId) return it;
      const style = it.style || { visible: true, colors: {}, widths: {} };
      return { ...it, style: { ...style, colors: { ...style.colors, [lineKey]: color } } };
    }));
  }
  function updateIndicatorLineWidth(instanceId, lineKey, width) {
    setActiveIndicators((prev) => prev.map((it) => {
      if (it.instanceId !== instanceId) return it;
      const style = it.style || { visible: true, colors: {}, widths: {} };
      return { ...it, style: { ...style, widths: { ...style.widths, [lineKey]: width } } };
    }));
  }
  /* اللون/السماكة الفعليين لخط معيّن بمؤشر - القيمة المخصصة لو موجودة، وإلا افتراضي تعريف المؤشر */
  function effectiveLineColor(it, line) { return it?.style?.colors?.[line.key] || line.color; }
  function effectiveLineWidth(it, line) { return it?.style?.widths?.[line.key] || line.lineWidth || 1.4; }

  /* أي تغيير بإعدادات لوحة المقارنة (نوع الشارت أو ألوانه): نعيد بناء السيريز فوراً ونحفظ بالمتصفح.
     منقّاة بنفس بيانات الشمعة الحالية عشان يبان التغيير مباشرة بدون قفل/إعادة تحميل. */
  useEffect(() => {
    saveCompareSettings(compareSettings);
    if (!compareChartRef.current) return;
    try {
      if (compareSeriesRef.current) compareChartRef.current.removeSeries(compareSeriesRef.current);
    } catch {}
    const series = buildCompareSeries(compareChartRef.current, compareSettings);
    compareSeriesRef.current = series;
    try {
      series.setData(compareSeriesData(compareSettings.type, compareCandles));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareSettings]);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { magnetRef.current = magnetOn; }, [magnetOn]);
  useEffect(() => { intervalRef.current = interval; }, [interval]);
  useEffect(() => { drawingsVisibleRef.current = drawingsVisible; scheduleDraw(); }, [drawingsVisible]);
  useEffect(() => { if (activeTool !== "cursor") clearSelection(); }, [activeTool]);
  useEffect(() => { setDrawingTemplatesMenuOpen(false); setTextPopoverOpen(false); }, [selectedDrawingId]);
  useEffect(() => { compareOpenRef.current = compareOpen; }, [compareOpen]);
  useEffect(() => { maximizedPaneRef.current = maximizedPane; }, [maximizedPane]);
  useEffect(() => { compareHeightPxRef.current = compareHeightPx; }, [compareHeightPx]);
  useEffect(() => { compareCandlesRef.current = compareCandles; }, [compareCandles]);
  /* useLayoutEffect لا useEffect: لازم visibleCandlesRef.current يتحدّث *قبل*
     useLayoutEffect تحديث الشارت تحت (سطر ~4381) يلي بينده scheduleDraw()
     ويرسم كل الرسومات (drawOverlay -> ptToLogical -> visibleCandlesRef.current).
     React بينفّذ كل الـ useLayoutEffect (بترتيب تسجيلها بالكومبوننت) *قبل* أي
     useEffect عادي - فلو خلّينا هاد useEffect عادي، بيصير سباق (race condition):
     أحياناً بينفّذ قبل رسمة الأوفرلاي (requestAnimationFrame تبع scheduleDraw
     ممكن يتأخر لبعد ما تفرغ كل الـ useEffect العادية فيضبط)، وأحياناً بينفّذ
     بعدها (لو المتصفح رسم الفريم التالي قبل ما يفضى React من الـ passive
     effects) - فبيصير drawOverlay يحسب logical كل نقطة رسم عبر مصفوفة شموع
     الفريم *القديم* (قبل تبديل الفريم)، فتظهر الرسمة بمكان غلط أو تختفي كلياً
     (index خارج مدى الشارت). تحويلها لـ useLayoutEffect + خليها *قبل*
     useLayoutEffect الرسم بترتيب التسجيل = يضمن visibleCandlesRef.current
     دايماً محدَّث فعلياً وقت ما drawOverlay بيقرأه، بدون أي سباق. */
  useLayoutEffect(() => {
    visibleCandlesRef.current = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
  }, [allCandles, revealCount, mode]);

  useEffect(() => { countdownRef.current = countdown; }, [countdown]);

  /* ===================== نقاط الرسم: time <-> logical (المصدر الوحيد) =====================
     كل نقطة رسم مخزّنة (p1/p2/points) بصيغة {time, price} - مش {logical, price}.
     أي مكان محتاج "logical" (يعني إحداثي بكسل على الشارت عبر
     timeScale().logicalToCoordinate) لازم يحسبه هون، live، من الـ time
     المخزّن + مصفوفة الشموع المعروضة حالياً فعلياً (visibleCandlesRef.current -
     نفس المصفوفة المضبوطة عبر seriesRef.current.setData()). هيك أي تبديل فريم
     (أو حتى تغيير عمق البيانات المحمّلة بنفس الفريم) بينعكس صح تلقائياً بكل
     رسمة/رندر، بدون أي خطوة "إعادة إسقاط" منفصلة ممكن ننسى نستدعيها بمسار كود
     معيّن. */
  function ptToLogical(p) {
    if (!p) return null;
    if (Number.isFinite(p.time)) return timeToLogicalForCandles(p.time, visibleCandlesRef.current);
    // توافق مؤقت: نقطة قديمة (نادراً، من قبل هالتعديل) لسا مخزّنة بصيغة
    // logical خام - منستخدمها كما هي بس مرة وحدة (ما بتنحفظ هيك، أول تحريك
    // أو رسمة جديدة بتحوّلها لـ time تلقائياً عبر setPointFromLogical).
    if (Number.isFinite(p.logical)) return p.logical;
    return null;
  }
  function ptFromLogical(logical, price) {
    return { time: logicalToTimeForCandles(logical, visibleCandlesRef.current), price };
  }
  function ptShiftLogical(p, dLogical) {
    // إزاحة نقطة بعدد "شمعات" (drag/duplicate) - لازم تصير بفضاء الـ logical
    // (نفس المنطق يلي بيحدد شكل السحب بالبكسل) وبعدين ترجع تنخزّن كـ time.
    const cur = ptToLogical(p);
    if (cur == null) return p;
    return ptFromLogical(cur + dLogical, p.price);
  }
  useEffect(() => {
    const baseLabel = getAssetByValue(assetValue)?.label || assetValue;
    symbolLabelRef.current = usedFuturesApprox ? `${baseLabel} (تقريب: عقود آجلة)` : baseLabel;
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetValue, usedFuturesApprox]);

  /* حساسية المغناطيس: يلتصق فقط لما المؤشر قريب فعلاً (بالبكسل) من قيمة أوبن/هاي/لو/كلوز
     الشمعة تحت المؤشر - مش فرض أقرب سعر دايماً. رفعنا نصف قطر الالتصاق (من 34 إلى 46
     بكسل) بناءً على طلب "مغناطيس أقوى" - بيلتصق بأقرب نقطة (الذيل: هاي/لو، أو الجسم:
     أوبن/كلوز) حسب أيهم أقرب فعلياً للماوس. */
  const SNAP_THRESHOLD_PX = 46;
  function snapPrice(logical, rawPrice, rawY) {
    // Shift مضغوط: تعطيل مؤقت للمغناطيس بدون تغيير إعداد Magnet نفسه - بيرجع
    // يشتغل عادي تلقائياً أول ما ينترفع زر Shift (شوفي onKeyUp)
    if (shiftPressedRef.current) return rawPrice;
    if (!magnetRef.current) return rawPrice;
    const series = seriesRef.current;
    if (!series || rawY == null) return rawPrice;
    const idx = Math.round(logical);
    const candle = visibleCandlesRef.current[idx];
    if (!candle) return rawPrice;
    const vals = [candle.open, candle.high, candle.low, candle.close];
    let best = null, bestDist = Infinity;
    for (const v of vals) {
      const y = series.priceToCoordinate(v);
      if (y == null) continue;
      const d = Math.abs(rawY - y);
      if (d < bestDist) { bestDist = d; best = v; }
    }
    if (best == null || bestDist > SNAP_THRESHOLD_PX) return rawPrice;
    return best;
  }

  /* تقييد زاوية الخط أثناء الرسم لما يكون Shift مضغوط - بالضبط متل تريدنغ فيو:
     بنحسب الزاوية بالبكسل (نظام إحداثيات الشاشة) بين نقطة البداية (p1) والموضع
     الحالي، ومنقرّبها لأقرب مضاعف لـ45 درجة (يعطي فعلياً 0°/45°/90°/135°/180°
     بالاتجاهين)، وبعدين منحول النقطة المقيّدة هاي رجوع لـ logical/price. */
  function applyAngleSnap(type, p1, rawLogical, rawPrice) {
    const fallback = { logical: rawLogical, price: rawPrice };
    if (!LINE_ANGLE_SNAP_TYPES.has(type) || !p1) return fallback;
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return fallback;
    const ts = chart.timeScale();
    const x1 = ts.logicalToCoordinate(p1.logical);
    const y1 = series.priceToCoordinate(p1.price);
    const x2 = ts.logicalToCoordinate(rawLogical);
    const y2 = series.priceToCoordinate(rawPrice);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return fallback;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return fallback;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const snappedAngle = Math.round(angle / 45) * 45;
    const rad = (snappedAngle * Math.PI) / 180;
    const nx = x1 + dist * Math.cos(rad);
    const ny = y1 + dist * Math.sin(rad);
    const newLogical = ts.coordinateToLogical(nx);
    const newPrice = series.coordinateToPrice(ny);
    if (newLogical == null || newPrice == null) return fallback;
    return { logical: newLogical, price: newPrice };
  }

  function drawOverlay() {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!canvas || !chart || !series) return;
    positionSelectionToolbar();
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    /* مهم: الصفحة كلها dir="rtl"، وكانفس بيورث الاتجاه هاد لعرض النصوص، يعني
       fillText كانت ترسم الأرقام معكوسة الاتجاه (تبدأ من x وتمتد لليسار) فتطلع
       فوق خلفية الشارت السودا بلون أسود = نص مخفي تماماً. تثبيت ltr هون بيخلي
       كل أسعار الخطوط تترسم مكانها الصح وتظهر واضحة جوا صناديقها. */
    ctx.direction = "ltr";
    ctx.textAlign = "left";

    /* أداة القص الجديدة (سحب لتحديد منطقة كاملة): 3 حالات محتملة بالرسم -
       1) منطقة "قيد التعديل" حالياً (لسا ما انطبقت): حدود متقطعة + تعتيم خارجها
          (اختياري حسب cutDimOutside) + تعبئة خفيفة جوّاها + مقابض حافة واضحة
          بوضعي "تحريك المنطقة"/"تعديل الحواف".
       2) لسا ما في منطقة (وضع "select" أول مرة): خط معاينة خفيف تحت الماوس،
          نفس المعاينة القديمة البسيطة.
       3) منطقة مطبّقة فعلياً وشغالة بالـ Replay (appliedCutRegion): حدود خفيفة
          بدون تعتيم ولا مقابض، مجرد تذكير بصري بحدود الجلسة الحالية، ما بتحذف
          ولا شمعة - إظهارها قابل للتعطيل من إعدادات القص (إظهار منطقة القص). */
    {
      const cm = cutModeRef.current;
      const region = cutRegionRef.current;
      const applied = appliedCutRegionRef.current;
      const showRegion = cutShowRegionRef.current;
      const dimOutside = cutDimOutsideRef.current;
      const sub = cutSubModeRef.current;
      const ts0 = chart.timeScale();

      const paintRegion = (fromLogical, toLogical, opts = {}) => {
        const x1 = ts0.logicalToCoordinate(fromLogical);
        const x2 = ts0.logicalToCoordinate(toLogical);
        if (x1 == null || x2 == null) return;
        const left = Math.min(x1, x2), right = Math.max(x1, x2);
        ctx.save();
        if (opts.dim) {
          ctx.fillStyle = "rgba(8,9,12,0.45)";
          ctx.fillRect(0, 0, left, h);
          ctx.fillRect(right, 0, Math.max(0, w - right), h);
        }
        if (opts.fill) {
          ctx.fillStyle = "rgba(212,175,55,0.06)";
          ctx.fillRect(left, 0, right - left, h);
        }
        ctx.strokeStyle = opts.color || GOLD_LIGHT;
        ctx.lineWidth = opts.lineWidth || 1.5;
        ctx.setLineDash(opts.dash || []);
        ctx.beginPath();
        ctx.moveTo(left, 0); ctx.lineTo(left, h);
        ctx.moveTo(right, 0); ctx.lineTo(right, h);
        ctx.stroke();
        ctx.setLineDash([]);
        if (opts.handles) {
          const gripY = h / 2;
          [left, right].forEach((gx) => {
            ctx.fillStyle = opts.color || GOLD_LIGHT;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(gx - 4, gripY - 14, 8, 28, 4);
            else ctx.rect(gx - 4, gripY - 14, 8, 28);
            ctx.fill();
            ctx.strokeStyle = "#0f1117";
            ctx.lineWidth = 1;
            ctx.stroke();
          });
        }
        ctx.restore();
      };

      if (cm && region) {
        paintRegion(region.fromLogical, region.toLogical, {
          dim: dimOutside, fill: true, color: GOLD_LIGHT,
          dash: sub === "select" ? [5, 4] : [],
          handles: sub === "edit-edges" || sub === "move",
        });
      } else if (cm && cutHoverLogicalRef.current != null) {
        const hoverX = ts0.logicalToCoordinate(cutHoverLogicalRef.current);
        if (hoverX != null) {
          ctx.save();
          ctx.fillStyle = "rgba(8,9,12,0.4)";
          ctx.fillRect(hoverX, 0, Math.max(0, w - hoverX), h);
          ctx.strokeStyle = GOLD_LIGHT;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(hoverX, 0);
          ctx.lineTo(hoverX, h);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          // تلميح التاريخ الكامل (اليوم + الرقم + الشهر + السنة + الوقت) فوق
          // خط المعاينة - عشان تعرفي بالضبط أي شمعة رح تنقص عليها قبل الكليك
          const vcHover = visibleCandlesRef.current || [];
          const hoverIdx = Math.max(0, Math.min(vcHover.length - 1, Math.round(cutHoverLogicalRef.current)));
          const hoverCandle = vcHover[hoverIdx];
          if (hoverCandle) {
            const label = formatCrosshairTime(hoverCandle.time);
            ctx.save();
            ctx.font = "bold 12px system-ui, sans-serif";
            const padX = 10;
            const textW = ctx.measureText(label).width;
            const boxW = textW + padX * 2;
            const boxH = 26;
            const boxX = Math.max(4, Math.min(w - boxW - 4, hoverX - boxW / 2));
            const boxY = 10;
            ctx.fillStyle = "rgba(15,17,23,0.95)";
            ctx.strokeStyle = GOLD_LIGHT;
            ctx.lineWidth = 1;
            if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 5); ctx.fill(); ctx.stroke(); }
            else { ctx.fillRect(boxX, boxY, boxW, boxH); ctx.strokeRect(boxX, boxY, boxW, boxH); }
            ctx.fillStyle = GOLD_LIGHT;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2 + 1);
            ctx.restore();
          }
        }
      } else if (!cm && applied && showRegion) {
        const vc = visibleCandlesRef.current || [];
        const fromIdx = vc.findIndex((c) => c.time >= applied.fromTime);
        let toIdx = vc.findIndex((c) => c.time >= applied.toTime);
        if (toIdx === -1) toIdx = vc.length - 1;
        if (fromIdx !== -1) {
          paintRegion(fromIdx, toIdx, { dim: false, fill: false, color: "#5b8dee", lineWidth: 1, dash: [3, 5] });
        }
      }
    }

    if (!drawingsVisibleRef.current) { ctx.restore(); return; }

    const ts = chart.timeScale();
    const toXY = (p) => ({ x: ts.logicalToCoordinate(ptToLogical(p)), y: series.priceToCoordinate(p.price) });
    const setLineStyle = (style = {}) => {
      ctx.strokeStyle = style.color || GOLD_LIGHT;
      ctx.fillStyle = style.color || GOLD_LIGHT;
      ctx.lineWidth = style.width || 1.5;
      ctx.setLineDash(style.dash === "dashed" ? [6, 4] : style.dash === "dotted" ? [2, 3] : []);
    };

    /* مناطق الربح/الخسارة تبع كل صفقة (بين الدخول والهدف = ربح، وبين الدخول
       والإيقاف = خسارة) - بألوان قابلة للتخصيص من الإعدادات، وترتسم تحت خطوط
       الصفقة نفسها. لازم تبدأ بالظبط من نقطة/وقت الدخول وتمتد يمين بس (نحو
       المستقبل)، وممنوع يظهر أي تظليل قبلها (شوفي طلب "ثالثاً: تظليل الصفقة") */
    const tradeGroups = {};
    for (const d of drawingsRef.current) {
      if (!d.tradeTag || d.hidden) continue;
      (tradeGroups[d.tradeTag] ||= {})[d.tradeRole] = d;
    }
    for (const tag in tradeGroups) {
      const g = tradeGroups[tag];
      if (!g.entry) continue;
      const entryY = series.priceToCoordinate(g.entry.p1.price);
      const entryXRaw = ts.logicalToCoordinate(ptToLogical(g.entry.p1));
      if (entryY == null || entryXRaw == null) continue;
      // نقصّ التظليل عند نقطة الدخول بالضبط (حتى لو جزء من الشمعة نفسها قبلها
      // بصرياً)، وما بنسمح تبدأ قبل حافة الشارت الشمال لو الدخول خارج النطاق الظاهر
      const entryX = Math.max(0, entryXRaw);
      const zoneW = Math.max(0, w - entryX);
      if (zoneW <= 0) continue;
      const opacity = chartSettingsRef.current.tradeZoneOpacity ?? 0.12;
      if (g.tp) {
        const tpY = series.priceToCoordinate(g.tp.p1.price);
        if (tpY != null) {
          ctx.fillStyle = hexToRgba(chartSettingsRef.current.tradeProfitZoneColor || GREEN, opacity);
          ctx.fillRect(entryX, Math.min(entryY, tpY), zoneW, Math.abs(entryY - tpY));
        }
      }
      if (g.sl) {
        const slY = series.priceToCoordinate(g.sl.p1.price);
        if (slY != null) {
          ctx.fillStyle = hexToRgba(chartSettingsRef.current.tradeLossZoneColor || RED, opacity);
          ctx.fillRect(entryX, Math.min(entryY, slY), zoneW, Math.abs(entryY - slY));
        }
      }
    }


    const all = [...drawingsRef.current];
    if (drawStateRef.current) all.push(drawStateRef.current);
    if ((activeToolRef.current === "path" || activeToolRef.current === "wave" || activeToolRef.current === "fibext" || activeToolRef.current === "parallelchannel" || activeToolRef.current === "fibchannel" || activeToolRef.current === "pitchfork" || activeToolRef.current === "triangle") && pathPointsRef.current.length) {
      const pts = [...pathPointsRef.current];
      if (liveCursorRef.current) pts.push(liveCursorRef.current);
      all.push({ type: activeToolRef.current, points: pts, style: defaultStyleFor(activeToolRef.current) });
    }

    for (const d of all) {
      if (d.hidden) continue;
      const style = d.style || defaultStyleFor(d.type);
      ctx.font = "11px sans-serif";
      ctx.lineWidth = style.width || 1.5;

      if (d.type === "hline") {
        const y = series.priceToCoordinate(d.p1.price);
        if (y == null) continue;
        setLineStyle({ ...style, dash: style.dash || "dashed" });
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.setLineDash([]);
        const roleLabel = d.tradeRole === "tp" ? "🎯 هدف (TP): " : d.tradeRole === "sl" ? "⛔ إيقاف (SL): " : d.tradeRole === "entry" ? "▶ دخول: " : "";
        /* السعر بيظهر بصندوق واضح ملاصق لمحور السعر يمين الشارت (مش على
           الحافة الشمال يلي بتضيع لما تكبري/تزحفي بالشارت) */
        ctx.font = "bold 11px sans-serif";
        const label = roleLabel ? roleLabel + d.p1.price.toFixed(2) : d.p1.price.toFixed(2);
        const tw = ctx.measureText(label).width;
        const boxW = tw + 12;
        const boxX = Math.max(4, w - boxW - 6);
        ctx.fillStyle = style.color || GOLD_LIGHT;
        ctx.fillRect(boxX, y - 10, boxW, 20);
        ctx.fillStyle = "#181A20";
        ctx.fillText(label, boxX + 6, y + 4);

      } else if (d.type === "hray") {
        const y = series.priceToCoordinate(d.p1.price);
        const x1 = ts.logicalToCoordinate(ptToLogical(d.p1));
        if (y == null || x1 == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(w, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(x1, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(d.p1.price.toFixed(2), x1 + 6, y - 4);

      } else if (d.type === "vline") {
        const x1 = ts.logicalToCoordinate(ptToLogical(d.p1));
        if (x1 == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, h); ctx.stroke();
        ctx.setLineDash([]);

      } else if (d.type === "trendline") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        let x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
        const ext = style.extend;
        if (ext === "right" || ext === "both") {
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          x2 = b.x + (dx / len) * 3000; y2 = b.y + (dy / len) * 3000;
        }
        if (ext === "left" || ext === "both") {
          const dx = a.x - b.x, dy = a.y - b.y, len = Math.hypot(dx, dy) || 1;
          x1 = a.x + (dx / len) * 3000; y1 = a.y + (dy / len) * 3000;
        }
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);

      } else if (d.type === "arrow") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const headLen = 11;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - headLen * Math.cos(angle - Math.PI / 7), b.y - headLen * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(b.x - headLen * Math.cos(angle + Math.PI / 7), b.y - headLen * Math.sin(angle + Math.PI / 7));
        ctx.closePath();
        ctx.fillStyle = style.color || GOLD_LIGHT;
        ctx.fill();

      } else if (d.type === "ray") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const x2 = a.x + (dx / len) * 3000, y2 = a.y + (dy / len) * 3000;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);

      } else if (d.type === "extendedline") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const x1 = a.x - (dx / len) * 3000, y1 = a.y - (dy / len) * 3000;
        const x2 = b.x + (dx / len) * 3000, y2 = b.y + (dy / len) * 3000;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);

      } else if (d.type === "crossline") {
        const y = series.priceToCoordinate(d.p1.price);
        const x = ts.logicalToCoordinate(ptToLogical(d.p1));
        if (y == null || x == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(d.p1.price.toFixed(2), x + 6, y - 4);

      } else if (d.type === "infoline") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
        [a, b].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
        const priceDiff = d.p2.price - d.p1.price;
        const pct = d.p1.price ? (priceDiff / d.p1.price) * 100 : 0;
        const bars = Math.round(ptToLogical(d.p2) - ptToLogical(d.p1));
        const angleDeg = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        ctx.font = "11px sans-serif";
        ctx.fillText(`${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${pct.toFixed(2)}%) | ${bars} شمعة | ${angleDeg.toFixed(1)}°`, midX + 6, midY - 6);

      } else if (d.type === "angle") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        setLineStyle(style);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y); ctx.stroke();
        ctx.setLineDash([]);
        const angleDeg = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
        const r = 22;
        const startAng = 0;
        const endAng = -((angleDeg * Math.PI) / 180) * (b.x >= a.x ? 1 : 1);
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, startAng, endAng, angleDeg > 0 ? true : false);
        ctx.stroke();
        ctx.fillText(`${angleDeg.toFixed(1)}°`, a.x + r + 4, a.y - 4);
        [a, b].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });

      } else if (d.type === "parallelchannel") {
        if (!d.points || d.points.length < 2) continue;
        const [p1, p2, p3] = d.points;
        const xy1 = toXY(p1), xy2 = toXY(p2);
        if (xy1.x == null || xy2.x == null) continue;
        setLineStyle(style);
        const dx = xy2.x - xy1.x, dy = xy2.y - xy1.y, len = Math.hypot(dx, dy) || 1;
        const ex1x = xy1.x - (dx / len) * 3000, ex1y = xy1.y - (dy / len) * 3000;
        const ex2x = xy2.x + (dx / len) * 3000, ex2y = xy2.y + (dy / len) * 3000;
        ctx.beginPath(); ctx.moveTo(ex1x, ex1y); ctx.lineTo(ex2x, ex2y); ctx.stroke();
        [xy1, xy2].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x != null) {
            // نحسب الإزاحة العمودية للخط الموازي بحيث يمر من النقطة الثالثة
            const nx = -dy / len, ny = dx / len;
            const offset = (xy3.x - xy1.x) * nx + (xy3.y - xy1.y) * ny;
            const o1x = ex1x + nx * offset, o1y = ex1y + ny * offset;
            const o2x = ex2x + nx * offset, o2y = ex2y + ny * offset;
            ctx.beginPath(); ctx.moveTo(o1x, o1y); ctx.lineTo(o2x, o2y); ctx.stroke();
            if (style.fill !== false) {
              ctx.fillStyle = hexToRgba(style.fillColor || GOLD, style.fillAlpha ?? 0.12);
              ctx.beginPath();
              ctx.moveTo(ex1x, ex1y); ctx.lineTo(ex2x, ex2y); ctx.lineTo(o2x, o2y); ctx.lineTo(o1x, o1y); ctx.closePath();
              ctx.fill();
            }
            ctx.beginPath(); ctx.arc(xy3.x, xy3.y, 2.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.setLineDash([]);

      } else if (d.type === "rectangle") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        if (style.fill !== false) { ctx.fillStyle = hexToRgba(style.fillColor || GOLD, style.fillAlpha ?? 0.15); ctx.fillRect(x, y, rw, rh); }
        ctx.strokeStyle = style.color || GOLD_LIGHT; ctx.lineWidth = style.width || 1.5;
        ctx.strokeRect(x, y, rw, rh);
        if (style.midline) {
          const midY = y + rh / 2;
          const midPrice = (d.p1.price + d.p2.price) / 2;
          ctx.strokeStyle = style.midlineColor || "#4caf50";
          ctx.lineWidth = 1.3;
          ctx.setLineDash(style.midlineDash === false ? [] : [4, 3]);
          ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x + rw, midY); ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = "11px sans-serif";
          ctx.fillStyle = style.midlineColor || "#4caf50";
          ctx.fillText(`50% - ${midPrice.toFixed(2)}`, x + rw + 4, midY - 3);
        }
        if (d.text) drawShapeText(ctx, d.text, x, y, rw, rh, style);

      } else if (d.type === "circle") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (style.fill !== false) { ctx.fillStyle = hexToRgba(style.fillColor || GOLD, style.fillAlpha ?? 0.18); ctx.fill(); }
        ctx.strokeStyle = style.color || GOLD_LIGHT; ctx.lineWidth = style.width || 1.5; ctx.stroke();

      } else if (d.type === "fib") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null || a.y == null || b.y == null) continue;
        const levels = (style.levels && style.levels.length ? style.levels : [
          { value: 0, color: style.color, enabled: true }, { value: 0.236, color: style.color, enabled: true },
          { value: 0.382, color: style.color, enabled: true }, { value: 0.5, color: style.color, enabled: true },
          { value: 0.618, color: style.color, enabled: true }, { value: 0.786, color: style.color, enabled: true },
          { value: 1, color: style.color, enabled: true },
        ]).filter((l) => l.enabled !== false);
        const x0raw = Math.min(a.x, b.x), x1raw = Math.max(a.x, b.x);
        const ext = style.extend || "none";
        const x0 = (ext === "left" || ext === "both") ? 0 : x0raw;
        const x1 = (ext === "right" || ext === "both") ? w : x1raw;
        const priceHigh = Math.max(d.p1.price, d.p2.price);
        const priceLow = Math.min(d.p1.price, d.p2.price);
        for (const lvl of levels) {
          const price = priceHigh - (priceHigh - priceLow) * lvl.value;
          const y = series.priceToCoordinate(price);
          if (y == null) continue;
          ctx.strokeStyle = lvl.color || style.color || GOLD_LIGHT;
          ctx.fillStyle = lvl.color || style.color || GOLD_LIGHT;
          ctx.lineWidth = style.width || 1.3;
          ctx.setLineDash(style.dash === "dashed" ? [4, 3] : style.dash === "dotted" ? [2, 3] : []);
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillText(`${(lvl.value * 100).toFixed(1)}% - ${price.toFixed(2)}`, x1raw + 4, y - 3);
        }

      } else if (d.type === "fibext") {
        if (!d.points || d.points.length < 2) continue;
        const [p1, p2, p3] = d.points;
        const xy1 = toXY(p1), xy2 = toXY(p2);
        if (xy1.x == null || xy2.x == null) continue;
        setLineStyle({ ...style, dash: "dashed", width: 1.3 });
        ctx.beginPath(); ctx.moveTo(xy1.x, xy1.y); ctx.lineTo(xy2.x, xy2.y);
        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x != null) ctx.lineTo(xy3.x, xy3.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = style.color || GOLD_LIGHT;
        [xy1, xy2, ...(p3 ? [toXY(p3)] : [])].forEach((p) => {
          if (p.x == null) return;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
        });

        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x == null) continue;
          const diff = p2.price - p1.price; // مقدار حركة الموجة الأساسية A→B
          const fallbackLevels = [
            { value: 0, color: "#787b86", enabled: true }, { value: 0.236, color: "#f23645", enabled: true },
            { value: 0.382, color: "#ff9800", enabled: true }, { value: 0.5, color: "#4caf50", enabled: true },
            { value: 0.618, color: "#00bcd4", enabled: true }, { value: 0.786, color: "#2196f3", enabled: true },
            { value: 1, color: "#787b86", enabled: true }, { value: 1.272, color: "#9c27b0", enabled: true },
            { value: 1.618, color: "#e91e63", enabled: true },
          ];
          const levels = (style.levels && style.levels.length ? style.levels : fallbackLevels).filter((l) => l.enabled !== false);
          const extendRight = (style.extend || "right") !== "none";
          const endX = extendRight ? w : xy3.x + 120;
          ctx.font = "11px sans-serif";
          for (const lvl of levels) {
            const price = p3.price + diff * lvl.value;
            const y = series.priceToCoordinate(price);
            if (y == null) continue;
            const col = lvl.color || style.color || GOLD_LIGHT;
            ctx.strokeStyle = col;
            ctx.fillStyle = col;
            ctx.lineWidth = style.width || 1.3;
            ctx.setLineDash(lvl.value === 0 || lvl.value === 1 ? [] : [3, 3]);
            ctx.beginPath(); ctx.moveTo(xy3.x, y); ctx.lineTo(endX, y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillText(`${(lvl.value * 100).toFixed(1)}% - ${price.toFixed(2)}`, xy3.x + 4, y - 3);
          }
        }

      } else if (d.type === "fibchannel") {
        if (!d.points || d.points.length < 2) continue;
        const [p1, p2, p3] = d.points;
        const xy1 = toXY(p1), xy2 = toXY(p2);
        if (xy1.x == null || xy2.x == null) continue;
        const dx = xy2.x - xy1.x, dy = xy2.y - xy1.y, len = Math.hypot(dx, dy) || 1;
        const ex1x = xy1.x - (dx / len) * 3000, ex1y = xy1.y - (dy / len) * 3000;
        const ex2x = xy2.x + (dx / len) * 3000, ex2y = xy2.y + (dy / len) * 3000;
        const nx = -dy / len, ny = dx / len;
        let offset = 0;
        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x != null) offset = (xy3.x - xy1.x) * nx + (xy3.y - xy1.y) * ny;
        }
        ctx.font = "10px sans-serif";
        const levels = (style.levels && style.levels.length ? style.levels : [
          { value: 0, color: style.color, enabled: true }, { value: 0.5, color: style.color, enabled: true }, { value: 1, color: style.color, enabled: true },
        ]).filter((l) => l.enabled !== false);
        for (const lvl of levels) {
          const off = offset * lvl.value;
          ctx.strokeStyle = lvl.color || style.color || GOLD_LIGHT;
          ctx.lineWidth = style.width || 1.3;
          ctx.setLineDash(lvl.value === 0 || lvl.value === 1 ? [] : [2, 3]);
          const lx1 = ex1x + nx * off, ly1 = ex1y + ny * off;
          const lx2 = ex2x + nx * off, ly2 = ex2y + ny * off;
          ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = lvl.color || style.color || GOLD_LIGHT;
          ctx.fillText(`${(lvl.value * 100).toFixed(1)}%`, lx2 - 30, ly2 - 3);
        }

      } else if (d.type === "fibtimezone") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        setLineStyle(style);
        const p1Logical = ptToLogical(d.p1);
        const barGap = Math.max(1, Math.abs(ptToLogical(d.p2) - p1Logical));
        const fibSeq = [1, 2, 3, 5, 8, 13, 21, 34, 55];
        ctx.font = "10px sans-serif";
        for (const n of fibSeq) {
          const logical = p1Logical + barGap * n;
          const x = ts.logicalToCoordinate(logical);
          if (x == null || x > w + 20) break;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillText(String(n), x + 3, 14);
        }

      } else if (d.type === "gannfan") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        setLineStyle(style);
        const priceUnit = (d.p2.price - d.p1.price) || 1;
        const p1LogicalGF = ptToLogical(d.p1);
        const barUnit = (ptToLogical(d.p2) - p1LogicalGF) || 1;
        const ratios = [[1, 8], [1, 4], [1, 2], [1, 1], [2, 1], [4, 1], [8, 1]];
        ctx.font = "10px sans-serif";
        for (const [pMul, tMul] of ratios) {
          const endLogical = p1LogicalGF + barUnit * tMul * Math.sign(barUnit || 1) * 3;
          const endPrice = d.p1.price + priceUnit * pMul * Math.sign(barUnit || 1) * 3;
          const endXY = toXY({ logical: endLogical, price: endPrice });
          if (endXY.x == null) continue;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(endXY.x, endXY.y); ctx.stroke();
          ctx.fillText(`${pMul}x${tMul}`, endXY.x, endXY.y);
        }

      } else if (d.type === "pitchfork") {
        if (!d.points || d.points.length < 2) continue;
        const [p1, p2, p3] = d.points;
        const xy1 = toXY(p1), xy2 = toXY(p2);
        if (xy1.x == null || xy2.x == null) continue;
        setLineStyle(style);
        [xy1, xy2].forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); });
        if (p3) {
          const xy3 = toXY(p3);
          if (xy3.x == null) continue;
          const midX = (xy2.x + xy3.x) / 2, midY = (xy2.y + xy3.y) / 2;
          const dx = midX - xy1.x, dy = midY - xy1.y, len = Math.hypot(dx, dy) || 1;
          const endX = xy1.x + (dx / len) * 3000, endY = xy1.y + (dy / len) * 3000;
          ctx.beginPath(); ctx.moveTo(xy1.x, xy1.y); ctx.lineTo(endX, endY); ctx.stroke();
          const upEndX = xy2.x + (dx / len) * 3000, upEndY = xy2.y + (dy / len) * 3000;
          const dnEndX = xy3.x + (dx / len) * 3000, dnEndY = xy3.y + (dy / len) * 3000;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(xy2.x, xy2.y); ctx.lineTo(upEndX, upEndY); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(xy3.x, xy3.y); ctx.lineTo(dnEndX, dnEndY); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(xy3.x, xy3.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }

      } else if (d.type === "path" || d.type === "wave" || d.type === "triangle") {
        if (!d.points || d.points.length < 1) continue;
        // TEMP DEBUG - احذفيها بعد ما نحل المشكلة
        if (d.type === "triangle") {
          console.log("[DEBUG render]", d.id, {
            storedPts: d.points.map((p) => ({ time: p.time, iso: p.time ? new Date(p.time * 1000).toISOString() : null, price: p.price })),
            logicals: d.points.map((p) => ptToLogical(p)),
            candlesRange: visibleCandlesRef.current.length
              ? { first: new Date(visibleCandlesRef.current[0].time * 1000).toISOString(), last: new Date(visibleCandlesRef.current[visibleCandlesRef.current.length - 1].time * 1000).toISOString(), count: visibleCandlesRef.current.length }
              : null,
          });
        }
        const pts = d.points.map(toXY).filter((p) => p.x != null && p.y != null);
        if (pts.length < 1) continue;
        setLineStyle(style);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        if (style.closed && pts.length > 2) ctx.closePath();
        ctx.stroke();
        if (style.closed && style.fill && pts.length > 2) {
          ctx.fillStyle = hexToRgba(style.fillColor || GOLD, style.fillAlpha ?? 0.15);
          ctx.fill();
        }
        ctx.setLineDash([]);
        for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
        if (d.type === "wave") {
          const labels = ["0", "A", "B", "C"];
          ctx.font = "12px sans-serif";
          pts.forEach((p, i) => ctx.fillText(labels[i] || "", p.x + 5, p.y - 6));
        }

      } else if (d.type === "text") {
        const p = toXY(d.p1);
        if (p.x == null || p.y == null) continue;
        ctx.fillStyle = style.color || GOLD_LIGHT;
        ctx.font = `${style.size || 13}px sans-serif`;
        ctx.fillText(d.text, p.x + 5, p.y - 5);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();

      } else if (d.type === "measure") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        const priceDiff = d.p2.price - d.p1.price;
        const pct = (priceDiff / d.p1.price) * 100;
        const bars = Math.round(ptToLogical(d.p2) - ptToLogical(d.p1));
        const col = priceDiff >= 0 ? GREEN : RED;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        ctx.fillStyle = priceDiff >= 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
        ctx.strokeStyle = col;
        ctx.fillRect(x, y, rw, rh); ctx.strokeRect(x, y, rw, rh);
        ctx.fillStyle = col; ctx.font = "12px sans-serif";
        ctx.fillText(`${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${pct.toFixed(2)}%) | ${bars} شمعة`, x + 5, y - 6);

      } else if (d.type === "pricerange") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        const priceDiff = d.p2.price - d.p1.price;
        const pct = (priceDiff / d.p1.price) * 100;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        const col = style.color || "#4f7cff";
        if (style.fill !== false) { ctx.fillStyle = hexToRgba(style.fillColor || col, style.fillAlpha ?? 0.2); ctx.fillRect(x, y, rw, rh); }
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, rw, rh);
        ctx.fillStyle = col; ctx.font = "12px sans-serif";
        ctx.fillText(`${priceDiff >= 0 ? "+" : ""}${priceDiff.toFixed(2)} (${pct.toFixed(2)}%)`, x + 5, y - 6);

      } else if (d.type === "daterange") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        const bars = Math.abs(Math.round(ptToLogical(d.p2) - ptToLogical(d.p1)));
        const stepMs = INTERVAL_MS[intervalRef.current] || 60000;
        const totalH = Math.floor((bars * stepMs) / 3600000);
        const days = Math.floor(totalH / 24);
        const hrs = totalH % 24;
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        const rw = Math.abs(b.x - a.x), rh = Math.abs(b.y - a.y);
        const col = style.color || "#4f7cff";
        if (style.fill !== false) { ctx.fillStyle = hexToRgba(style.fillColor || col, style.fillAlpha ?? 0.2); ctx.fillRect(x, y, rw, rh); }
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, rw, rh);
        ctx.fillStyle = col; ctx.font = "12px sans-serif";
        ctx.fillText(`${bars} شمعة، ${days} يوم ${hrs} ساعة`, x + 5, y - 6);

      } else if (d.type === "position_long" || d.type === "position_short") {
        const a = toXY(d.p1), b = toXY(d.p2);
        if (a.x == null || b.x == null) continue;
        const entryY = a.y;
        const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
        /* الهدف والوقف هلأ مستقلين تماماً عن بعض: كل وحدة عندها سعرها الخاص
           (targetPrice/stopPrice) يلي ممكن تتسحب لحالها بمقبضها، بدل ما تكون
           دايماً متماثلة (1:1) متل قبل */
        const { targetPrice, stopPrice, entryPrice } = getPositionLevels(d);
        const targetY = series.priceToCoordinate(targetPrice);
        const stopY = series.priceToCoordinate(stopPrice);
        if (targetY == null || stopY == null) continue;
        const alpha = style.alpha ?? 0.3;
        ctx.fillStyle = hexToRgba(style.targetColor || GREEN, alpha);
        ctx.fillRect(x0, Math.min(targetY, entryY), x1 - x0, Math.abs(entryY - targetY));
        ctx.fillStyle = hexToRgba(style.stopColor || RED, alpha);
        ctx.fillRect(x0, Math.min(entryY, stopY), x1 - x0, Math.abs(stopY - entryY));
        ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, entryY); ctx.lineTo(x1, entryY); ctx.stroke();
        const rewardPct = (((targetPrice - entryPrice) / entryPrice) * 100);
        const riskPct = (((stopPrice - entryPrice) / entryPrice) * 100);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#ccc";
        ctx.fillText(`الدخول: ${entryPrice.toFixed(2)}`, x0 + 4, entryY - 4);
        ctx.fillStyle = GREEN;
        ctx.fillText(`الهدف: ${targetPrice.toFixed(2)} (${rewardPct >= 0 ? "+" : ""}${rewardPct.toFixed(2)}%)`, x0 + 4, Math.min(targetY, entryY) - 4);
        ctx.fillStyle = RED;
        ctx.fillText(`الإيقاف: ${stopPrice.toFixed(2)} (${riskPct >= 0 ? "+" : ""}${riskPct.toFixed(2)}%)`, x0 + 4, Math.max(stopY, entryY) + 14);
      }
    }

    /* ===== مقابض تحديد مرئية (Handles) على الرسمة المحددة، بستايل تريدنغ فيو:
       دوائر زرقاء صغيرة عالنقاط/الزوايا، ومربعات صغيرة بمنتصف أضلاع المستطيل،
       عشان يبين وضوح إنه في إمكانية سحب/تمديد كل نقطة لحالها ===== */
    const selectedForHandles = selectedIdRef.current != null
      ? drawingsRef.current.find((d) => d.id === selectedIdRef.current)
      : null;
    if (selectedForHandles && !selectedForHandles.locked) {
      const handles = getHandlePoints(selectedForHandles);
      for (const h of handles) {
        const xy = toXY(h.p);
        if (xy.x == null || xy.y == null) continue;
        const isEdgeMid = h.key === "top" || h.key === "bottom" || h.key === "left" || h.key === "right";
        ctx.beginPath();
        if (isEdgeMid) {
          ctx.rect(xy.x - 4.5, xy.y - 4.5, 9, 9);
        } else {
          ctx.arc(xy.x, xy.y, 5, 0, Math.PI * 2);
        }
        ctx.fillStyle = "#131722";
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "#2962FF";
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ===== جدولة الرسم عبر requestAnimationFrame =====
     قبل هيك، كل حدث (سحب، زوم، حركة ماوس، تحريك مؤشر التقاطع...) كان بينادي
     drawOverlay() مباشرة وبشكل متزامن - فإذا صار أكتر من حدث بنفس الفريم
     (مثلاً بان بيطلق subscribeVisibleLogicalRangeChange وكمان mousemove بنفس
     اللحظة)، كنا فعلياً منعيد رسم الكانفس كامل أكتر من مرة بنفس الفريم =
     شغل زائد عالمعالج بيسبب تقطيع (jank) خصوصاً مع مئات الرسومات وآلاف
     الشموع. هلق كل الاستدعاءات بتمر من هون فبتنجمع لرسمة وحدة فعلية لكل
     فريم شاشة (يعني حد أقصى مضمون قريب من 60FPS)، بدون ما نأخر أي حدث فعلي
     (الحالة نفسها بتتحدث فوراً بالـ ref، بس الرسم المرئي بينتظر الفريم
     الجاي فقط - أقل من 16ms، غير محسوس إطلاقاً). */
  const rafPendingRef = useRef(false);
  function scheduleDraw() {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      drawOverlay();
    });
  }

  /* ===================== اختيار وتعديل رسمة موجودة ===================== */
  function logicalPriceToXY(p) {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return { x: null, y: null };
    return { x: chart.timeScale().logicalToCoordinate(ptToLogical(p)), y: series.priceToCoordinate(p.price) };
  }
  function distanceToDrawingPx(d, x, y) {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return Infinity;
    try {
      switch (d.type) {
        case "hline": {
          const py = series.priceToCoordinate(d.p1.price);
          return py == null ? Infinity : Math.abs(y - py);
        }
        case "hray": {
          const py = series.priceToCoordinate(d.p1.price);
          const px1 = chart.timeScale().logicalToCoordinate(ptToLogical(d.p1));
          if (py == null || px1 == null || x < px1 - 4) return Infinity;
          return Math.abs(y - py);
        }
        case "vline": {
          const px1 = chart.timeScale().logicalToCoordinate(ptToLogical(d.p1));
          return px1 == null ? Infinity : Math.abs(x - px1);
        }
        case "trendline": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          return pointSegDist(x, y, a.x, a.y, b.x, b.y);
        }
        case "ray": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const ex = a.x + (dx / len) * 3000, ey = a.y + (dy / len) * 3000;
          return pointSegDist(x, y, a.x, a.y, ex, ey);
        }
        case "extendedline": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const x1 = a.x - (dx / len) * 3000, y1 = a.y - (dy / len) * 3000;
          const x2 = b.x + (dx / len) * 3000, y2 = b.y + (dy / len) * 3000;
          return pointSegDist(x, y, x1, y1, x2, y2);
        }
        case "infoline":
        case "angle": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          return pointSegDist(x, y, a.x, a.y, b.x, b.y);
        }
        case "crossline": {
          const py = series.priceToCoordinate(d.p1.price);
          const px = chart.timeScale().logicalToCoordinate(ptToLogical(d.p1));
          if (py == null || px == null) return Infinity;
          return Math.min(Math.abs(y - py), Math.abs(x - px));
        }
        case "parallelchannel":
        case "fibchannel":
        case "pitchfork": {
          if (!d.points || d.points.length < 2) return Infinity;
          const a = logicalPriceToXY(d.points[0]), b = logicalPriceToXY(d.points[1]);
          if (a.x == null || b.x == null) return Infinity;
          return pointSegDist(x, y, a.x, a.y, b.x, b.y);
        }
        case "fibtimezone":
        case "gannfan": {
          const a = logicalPriceToXY(d.p1);
          if (a.x == null) return Infinity;
          return Math.hypot(x - a.x, y - a.y) < 40 ? 0 : Infinity;
        }
        case "rectangle":
        case "circle":
        case "pricerange":
        case "daterange": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const x0 = Math.min(a.x, b.x), x1e = Math.max(a.x, b.x);
          const y0 = Math.min(a.y, b.y), y1e = Math.max(a.y, b.y);
          if (x >= x0 && x <= x1e && y >= y0 && y <= y1e) return 0;
          const dx = x < x0 ? x0 - x : x > x1e ? x - x1e : 0;
          const dy = y < y0 ? y0 - y : y > y1e ? y - y1e : 0;
          return Math.hypot(dx, dy);
        }
        case "position_long":
        case "position_short": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const { targetPrice, stopPrice } = getPositionLevels(d);
          const targetY = series.priceToCoordinate(targetPrice);
          const stopY = series.priceToCoordinate(stopPrice);
          const ys = [a.y, targetY, stopY].filter((v) => v != null);
          const x0 = Math.min(a.x, b.x), x1e = Math.max(a.x, b.x);
          const y0 = Math.min(...ys), y1e = Math.max(...ys);
          return (x >= x0 && x <= x1e && y >= y0 && y <= y1e) ? 0 : 9999;
        }
        case "fib": {
          const a = logicalPriceToXY(d.p1), b = logicalPriceToXY(d.p2);
          if (a.x == null || b.x == null) return Infinity;
          const style = d.style || {};
          const x0 = Math.min(a.x, b.x), x1e = Math.max(a.x, b.x);
          if (x < x0 - 5 || x > x1e + 5) return Infinity;
          const levels = (style.levels && style.levels.length ? style.levels : [{ value: 0 }, { value: 0.236 }, { value: 0.382 }, { value: 0.5 }, { value: 0.618 }, { value: 0.786 }, { value: 1 }]).filter((l) => l.enabled !== false);
          const priceHigh = Math.max(d.p1.price, d.p2.price);
          const priceLow = Math.min(d.p1.price, d.p2.price);
          let best = Infinity;
          for (const lvl of levels) {
            const py = series.priceToCoordinate(priceHigh - (priceHigh - priceLow) * lvl.value);
            if (py != null) best = Math.min(best, Math.abs(y - py));
          }
          return best;
        }
        case "path":
        case "wave":
        case "fibext": {
          if (!d.points || d.points.length < 2) return Infinity;
          let best = Infinity;
          for (let i = 0; i < d.points.length - 1; i++) {
            const a = logicalPriceToXY(d.points[i]), b = logicalPriceToXY(d.points[i + 1]);
            if (a.x == null || b.x == null) continue;
            best = Math.min(best, pointSegDist(x, y, a.x, a.y, b.x, b.y));
          }
          return best;
        }
        case "text": {
          const p = logicalPriceToXY(d.p1);
          if (p.x == null) return Infinity;
          return Math.hypot(x - p.x, y - p.y);
        }
        default:
          return Infinity;
      }
    } catch {
      return Infinity;
    }
  }
  /* نصف قطر التحديد الأساسي رفعناه من 8 لـ 9 بكسل (تقارب حسية أقرب لتريدنغ
     فيو)، وبيتوسع أكتر تلقائياً إذا كان سماكة الخط نفسه أعرض من الافتراضي -
     خط سماكة 4 أو 5 بكسل لازم منطقة النقر فوقه تكون أعرض من خط سماكة 1،
     وإلا بيحس المستخدم إنه "بينقر عالخط تماماً" بس ما بينتحدد = محاولات متكررة. */
  function hitToleranceFor(d) {
    const w = d?.style?.width || 1.5;
    return Math.max(9, w / 2 + 7);
  }
  function findDrawingAt(x, y) {
    let best = null, bestDist = Infinity;
    for (const d of drawingsRef.current) {
      const tol = hitToleranceFor(d);
      const dist = distanceToDrawingPx(d, x, y);
      if (dist <= tol && dist < bestDist) { bestDist = dist; best = d; }
    }
    return best;
  }

  /* ===================== سحب وتحريك الرسومات (وضع المؤشر) ===================== */
  function getHandlePoints(d) {
    if (d.points) return d.points.map((p, i) => ({ key: `points.${i}`, p }));
    const out = [];
    if (d.p1) out.push({ key: "p1", p: d.p1 });
    if (d.p2) out.push({ key: "p2", p: d.p2 });
    /* أداة مركز الشراء/البيع بتحصل على مقبضين إضافيين مستقلين: واحد لخط
       الهدف وواحد لخط وقف الخسارة، عشان تقدري تسحبي كل خط لحاله بدون ما
       يتحرك التاني (بدل النسبة الثابتة 1:1 يلي كانت موجودة قبل) */
    if ((d.type === "position_long" || d.type === "position_short") && d.p1 && d.p2) {
      const { targetPrice, stopPrice } = getPositionLevels(d);
      const midLogical = (ptToLogical(d.p1) + ptToLogical(d.p2)) / 2;
      out.push({ key: "target", p: { logical: midLogical, price: targetPrice } });
      out.push({ key: "stop", p: { logical: midLogical, price: stopPrice } });
    }
    /* المستطيل بيحصل على 4 مقابض إضافية بمنتصف كل ضلع، تماماً متل صندوق التحديد
       بتريدنغ فيو (8 مقابض: 4 زوايا + 4 منتصف أضلاع)، عشان تقدري تمددي عرض أو
       ارتفاع المستطيل لحاله من دون ما تحركي الزاوية المقابلة */
    if (d.type === "rectangle" && d.p1 && d.p2) {
      const p1Logical = ptToLogical(d.p1), p2Logical = ptToLogical(d.p2);
      const midLogical = (p1Logical + p2Logical) / 2;
      const midPrice = (d.p1.price + d.p2.price) / 2;
      out.push({ key: "top", p: { logical: midLogical, price: Math.max(d.p1.price, d.p2.price) } });
      out.push({ key: "bottom", p: { logical: midLogical, price: Math.min(d.p1.price, d.p2.price) } });
      out.push({ key: "left", p: { logical: Math.min(p1Logical, p2Logical), price: midPrice } });
      out.push({ key: "right", p: { logical: Math.max(p1Logical, p2Logical), price: midPrice } });
    }
    return out;
  }
  /* نصف قطر مسك المقابض رفعناه من 8 لـ 10 بكسل - نقطة تحكم صغيرة أصعب
     تصويب من خط، فمنطقتها لازم تكون أوسع شوي منه، وهاي بالضبط فلسفة
     تريدنغ فيو (Handles أسهل مسكة من جسم الرسمة نفسه). */
  function findHandleAt(x, y) {
    const HANDLE_R = 10;
    let best = null, bestDist = HANDLE_R;
    for (const d of drawingsRef.current) {
      for (const h of getHandlePoints(d)) {
        const xy = logicalPriceToXY(h.p);
        if (xy.x == null || xy.y == null) continue;
        const dist = Math.hypot(x - xy.x, y - xy.y);
        if (dist <= bestDist) { bestDist = dist; best = { drawing: d, key: h.key }; }
      }
    }
    return best;
  }
  function moveDrawingBy(d, dLogical, dPrice) {
    if (d.p1) { d.p1 = { ...ptShiftLogical(d.p1, dLogical), price: d.p1.price + dPrice }; }
    if (d.p2) { d.p2 = { ...ptShiftLogical(d.p2, dLogical), price: d.p2.price + dPrice }; }
    if (d.points) d.points = d.points.map((p) => ({ ...ptShiftLogical(p, dLogical), price: p.price + dPrice }));
    if (d.targetPrice != null) d.targetPrice += dPrice;
    if (d.stopPrice != null) d.stopPrice += dPrice;
  }
  function setHandlePoint(d, key, logical, price) {
    if (key === "p1") d.p1 = ptFromLogical(logical, price);
    else if (key === "p2") d.p2 = ptFromLogical(logical, price);
    else if (key === "target") d.targetPrice = price;
    else if (key === "stop") d.stopPrice = price;
    else if (key === "top" || key === "bottom") {
      // نلاقي أي زاوية (p1 أو p2) هي صاحبة السعر الأعلى/الأدنى ونعدّل سعرها بس،
      // والموضع الأفقي بيضل ثابت متل ما هو
      const corner = key === "top"
        ? (d.p1.price >= d.p2.price ? "p1" : "p2")
        : (d.p1.price <= d.p2.price ? "p1" : "p2");
      d[corner] = { ...d[corner], price };
    } else if (key === "left" || key === "right") {
      const corner = key === "left"
        ? (ptToLogical(d.p1) <= ptToLogical(d.p2) ? "p1" : "p2")
        : (ptToLogical(d.p1) >= ptToLogical(d.p2) ? "p1" : "p2");
      d[corner] = { ...d[corner], ...ptFromLogical(logical, d[corner].price) };
    } else if (key.startsWith("points.")) {
      const idx = Number(key.split(".")[1]);
      if (d.points && d.points[idx] != null) {
        d.points = d.points.map((p, i) => (i === idx ? ptFromLogical(logical, price) : p));
      }
    }
  }
  function openProperties(d) {
    clearSelection();
    setEditingId(d.id);
    setEditDraft(JSON.parse(JSON.stringify(d)));
  }

  /* ===== إغلاق كل القوائم/النوافذ المؤقتة دفعة وحدة (زي تريدنغ فيو) =====
     منستدعيها من أي حدث "بيقفل القوائم المؤقتة عادةً": كليك بمساحة فاضية،
     بدء رسم، تغيير أداة، Escape، بان، زوم، تغيير فريم أو رمز... إلخ. */
  function closeTransientMenus() {
    setContextMenu(null);
    setOpenToolGroup(null);
    setDrawingTemplatesMenuOpen(false);
    setTextPopoverOpen(false);
  }

  /* ===== تراجع/إعادة (Undo/Redo) =====
     pushHistory() لازم تنستدعى *قبل* أي تعديل فعلي عالرسومات، عشان تحفظ
     الحالة "متل ما كانت" قبل التعديل. أي عملية تراجع/إعادة بترجع نسخة كاملة
     من مصفوفة الرسومات (بما فيها خطوط الهدف/الإيقاف تبع صفقة مفتوحة). */
  function pushHistory() {
    try {
      historyRef.current.push(JSON.parse(JSON.stringify(drawingsRef.current)));
      if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
      redoStackRef.current = [];
    } catch {}
  }
  function performUndo() {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop();
    redoStackRef.current.push(JSON.parse(JSON.stringify(drawingsRef.current)));
    drawingsRef.current = prev;
    clearSelection();
    setEditingId(null);
    setEditDraft(null);
    scheduleDraw();
  }
  function performRedo() {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop();
    historyRef.current.push(JSON.parse(JSON.stringify(drawingsRef.current)));
    drawingsRef.current = next;
    clearSelection();
    setEditingId(null);
    setEditDraft(null);
    scheduleDraw();
  }

  /* ===== اختيار رسمة بكبسة وحدة: يطلع شريط أدوات سريع فوقها مباشرة ===== */
  function selectDrawing(id) {
    selectedIdRef.current = id;
    setSelectedDrawingId(id);
    setEditingId(null);
    setEditDraft(null);
  }
  function clearSelection() {
    if (selectedIdRef.current == null) return;
    selectedIdRef.current = null;
    setSelectedDrawingId(null);
  }
  function getSelectedDrawing() {
    if (selectedIdRef.current == null) return null;
    return drawingsRef.current.find((d) => d.id === selectedIdRef.current) || null;
  }
  /* remember = true يعني هاد تعديل مباشر من المستخدم على خاصية (لون/سماكة/تعبئة..)
     فبنحدّث "آخر إعدادات الأداة" (Last Used Tool State) لهاد النوع تلقائيًا.
     remember = false بتنستخدم لما التحديث جاي من تطبيق Template جاهز (مش تعديل
     مباشر)، عشان القوالب تضل منفصلة عن ذاكرة "آخر استخدام" حسب المطلوب */
  function updateSelectedStyle(patch, { remember = true } = {}) {
    const idx = drawingsRef.current.findIndex((d) => d.id === selectedIdRef.current);
    if (idx === -1) return;
    const type = drawingsRef.current[idx].type;
    drawingsRef.current[idx] = { ...drawingsRef.current[idx], style: { ...drawingsRef.current[idx].style, ...patch } };
    if (remember) rememberLastUsedStyle(type, patch);
    scheduleDraw();
    setSelectionRenderTick((t) => t + 1);
  }
  function toggleSelectedLock() {
    const idx = drawingsRef.current.findIndex((d) => d.id === selectedIdRef.current);
    if (idx === -1) return;
    drawingsRef.current[idx] = { ...drawingsRef.current[idx], locked: !drawingsRef.current[idx].locked };
    scheduleDraw();
    setSelectionRenderTick((t) => t + 1);
  }
  // إخفاء/إظهار هاي الرسمة لحالها بس (بدون التأثير على باقي الرسومات)
  function toggleSelectedHidden() {
    const idx = drawingsRef.current.findIndex((d) => d.id === selectedIdRef.current);
    if (idx === -1) return;
    drawingsRef.current[idx] = { ...drawingsRef.current[idx], hidden: !drawingsRef.current[idx].hidden };
    scheduleDraw();
    setSelectionRenderTick((t) => t + 1);
  }
  // قفل/فك قفل كل الرسومات دفعة وحدة (زر "قفل" بالشريط الجانبي)
  function toggleLockAllDrawings() {
    const list = drawingsRef.current.filter((d) => !d.tradeTag);
    if (list.length === 0) return;
    const nextLocked = !allDrawingsLockedRef.current;
    drawingsRef.current = drawingsRef.current.map((d) => (d.tradeTag ? d : { ...d, locked: nextLocked }));
    allDrawingsLockedRef.current = nextLocked;
    setAllDrawingsLocked(nextLocked);
    scheduleDraw();
  }
  function deleteSelectedDrawing() {
    if (selectedIdRef.current == null) return;
    pushHistory();
    drawingsRef.current = drawingsRef.current.filter((d) => d.id !== selectedIdRef.current);
    clearSelection();
    scheduleDraw();
  }
  function duplicateSelectedDrawing() {
    const d = getSelectedDrawing();
    if (!d) return;
    pushHistory();
    const offset = 6;
    const clone = JSON.parse(JSON.stringify(d));
    clone.id = Date.now();
    if (clone.p1) clone.p1 = { ...clone.p1, ...ptShiftLogical(clone.p1, offset) };
    if (clone.p2) clone.p2 = { ...clone.p2, ...ptShiftLogical(clone.p2, offset) };
    if (clone.points) clone.points = clone.points.map((p) => ({ ...p, ...ptShiftLogical(p, offset) }));
    drawingsRef.current.push(clone);
    selectDrawing(clone.id);
    scheduleDraw();
  }
  /* إضافة/تعديل نص على الرسمة المختارة مباشرة من الشريط العائم، من غير ما نفوّت
     على لوحة "كل الإعدادات" الكاملة */
  function openQuickTextPopover() {
    const d = getSelectedDrawing();
    setTextPopoverValue(d?.text || "");
    setDrawingTemplatesMenuOpen(false);
    setTextPopoverOpen((v) => !v);
  }
  function applyQuickText() {
    const idx = drawingsRef.current.findIndex((dr) => dr.id === selectedIdRef.current);
    if (idx !== -1) {
      pushHistory();
      drawingsRef.current[idx] = { ...drawingsRef.current[idx], text: textPopoverValue };
      scheduleDraw();
    }
    setTextPopoverOpen(false);
  }
  /* بتحسب مكان الشريط العائم *مرة وحدة بس* (أول ظهور له)، وبعدها بيضل بمكانه
     بغض النظر عن تغيير الرسمة المختارة أو الزوم/البان - تماماً متل تريدنغ فيو:
     شريط عائم مستقل بيتحرك بس لما المستخدم نفسه يسحبه (شوفي onToolbarDragStart) */
  function positionSelectionToolbar() {
    const el = selectionToolbarRef.current;
    if (!el) return;
    const d = getSelectedDrawing();
    if (!d) { el.style.display = "none"; return; }
    el.style.display = "flex";
    if (toolbarPosRef.current) {
      el.style.left = `${toolbarPosRef.current.x}px`;
      el.style.top = `${toolbarPosRef.current.y}px`;
      return;
    }
    const pts = [];
    if (d.p1) pts.push(logicalPriceToXY(d.p1));
    if (d.p2) pts.push(logicalPriceToXY(d.p2));
    if (d.points) d.points.forEach((p) => pts.push(logicalPriceToXY(p)));
    const valid = pts.filter((p) => p.x != null && p.y != null);
    if (!valid.length) { el.style.display = "none"; return; }
    const minX = Math.min(...valid.map((p) => p.x));
    const maxX = Math.max(...valid.map((p) => p.x));
    const minY = Math.min(...valid.map((p) => p.y));
    const areaW = chartAreaRef.current?.clientWidth || 0;
    const cx = Math.min(Math.max((minX + maxX) / 2, 100), Math.max(100, areaW - 100));
    const top = Math.max(6, minY - 46);
    toolbarPosRef.current = { x: cx, y: top };
    el.style.left = `${cx}px`;
    el.style.top = `${top}px`;
  }
  /* سحب الشريط العائم بالماوس من أيقونة "::" - بتحدّث toolbarPosRef مباشرة
     (imperative، بدون re-render بكل حركة ماوس) عشان السحب يكون سلس بدون تقطيع */
  function onToolbarDragStart(e) {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const orig = toolbarPosRef.current || { x: 0, y: 0 };
    function onMove(ev) {
      const nx = orig.x + (ev.clientX - startX);
      const ny = orig.y + (ev.clientY - startY);
      toolbarPosRef.current = { x: nx, y: ny };
      const el = selectionToolbarRef.current;
      if (el) { el.style.left = `${nx}px`; el.style.top = `${ny}px`; }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  function saveProperties() {
    if (!editDraft) return;
    pushHistory();
    const idx = drawingsRef.current.findIndex((d) => d.id === editDraft.id);
    if (idx !== -1) drawingsRef.current[idx] = editDraft;
    // تعديل مباشر من لوحة "كل الإعدادات" لازم يتحفظ كـ"آخر إعدادات" لهاد نوع
    // الأداة تلقائيًا (نفس منطق الشريط العائم السريع)
    if (editDraft.style) rememberLastUsedStyle(editDraft.type, editDraft.style);
    setEditingId(null);
    setEditDraft(null);
    scheduleDraw();
  }
  function deleteEditingDrawing() {
    if (!editDraft) return;
    pushHistory();
    drawingsRef.current = drawingsRef.current.filter((d) => d.id !== editDraft.id);
    setEditingId(null);
    setEditDraft(null);
    scheduleDraw();
  }
  function finishMultiPoint() {
    const pts = pathPointsRef.current;
    const tool = activeToolRef.current;
    if (pts && pts.length >= 2) {
      pushHistory();
      const newId = Date.now();
      const storedPts = pts.map((p) => ptFromLogical(p.logical, p.price));
      // TEMP DEBUG - احذفيها بعد ما نحل المشكلة: نطبع وقت/سعر كل نقطة مخزّنة +
      // أول وآخر شمعة بمصفوفة الشموع يلي استخدمناها للتحويل، عشان نتأكد التخزين صح.
      console.log("[DEBUG create]", tool, {
        storedPts: storedPts.map((p) => ({ time: p.time, iso: p.time ? new Date(p.time * 1000).toISOString() : null, price: p.price })),
        candlesRange: visibleCandlesRef.current.length
          ? { first: new Date(visibleCandlesRef.current[0].time * 1000).toISOString(), last: new Date(visibleCandlesRef.current[visibleCandlesRef.current.length - 1].time * 1000).toISOString(), count: visibleCandlesRef.current.length }
          : null,
      });
      drawingsRef.current.push({ id: newId, type: tool, points: storedPts, style: styleForNewDrawing(tool) });
      selectDrawing(newId); // نقاط التحكم تظهر تلقائياً فوراً بعد إنشاء الأداة متعددة النقاط
    }
    pathPointsRef.current = [];
    liveCursorRef.current = null;
    setActiveTool("cursor");
    scheduleDraw();
  }

  function handleClearDrawings() {
    const clearable = drawingsRef.current.filter((d) => !d.tradeTag);
    if (clearable.length === 0) return;
    if (!window.confirm("مسح كل الرسومات من الشارت؟ (خطوط الهدف/الإيقاف لصفقة مفتوحة ما بتتأثر)")) return;
    pushHistory();
    drawingsRef.current = drawingsRef.current.filter((d) => !!d.tradeTag);
    scheduleDraw();
  }
  // تراجع عن آخر رسمة (بيتجاهل خطوط الهدف/الإيقاف الخاصة بصفقة مفتوحة)
  function handleUndoLastDrawing() {
    const list = drawingsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].tradeTag) {
        drawingsRef.current = list.filter((_, idx) => idx !== i);
        scheduleDraw();
        return;
      }
    }
  }
  function toggleDrawingsVisible() { setDrawingsVisible((v) => !v); }
  function handleResetView() {
    chartRef.current?.timeScale().fitContent();
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
  }

  const assetInfo = getAssetByValue(assetValue);
  const supported = randomChart || !!assetInfo?.yahoo;

  /* ===================== شراء/بيع فوري مربوط بالباك تيست ===================== */
  function getCurrentPrice() {
    const arr = visibleCandlesRef.current;
    if (arr && arr.length) return arr[arr.length - 1].close;
    return liveLastPrice;
  }

  /* نسخة عامة من getLogicalPrice تشتغل بره الـ effect الكبير تبع إنشاء الشارت
     (بالاعتماد على الـ refs مباشرة، نفس الكائنات) - محتاجينها هون عشان قائمة
     الكليك اليمين تصير قابلة لإعادة الفتح من أكتر من مكان بنفس المنطق */
  function getLogicalPriceGlobal(clientX, clientY) {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!canvas || !chart || !series) return { logical: null, price: null, x: null, y: null };
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const logical = chart.timeScale().coordinateToLogical(x);
    const price = series.coordinateToPrice(y);
    return { logical, price, x, y };
  }

  /* فتح/إعادة فتح قائمة الكليك اليمين (شراء/بيع): أي كليك يمين جديد لازم يقفل
     القائمة القديمة (إن وجدت) ويفتح وحدة جديدة بمكان الكليك الجديد فوراً بنفس
     الحركة - مش يحتاج كليكتين. بما إنها State وحدة (مش Array)، ما بينفتح غير
     قائمة وحدة بأي لحظة أصلاً؛ هاي الدالة مشتركة بين معالج الكليك عالشارت وبين
     طبقة "اضغط برا لتقفل" تحت بالـ JSX عشان يصير نفس السلوك من الجهتين. */
  function openContextMenuAt(clientX, clientY) {
    const areaRect = chartAreaRef.current?.getBoundingClientRect();
    const insideChart = !!areaRect && clientX >= areaRect.left && clientX <= areaRect.right && clientY >= areaRect.top && clientY <= areaRect.bottom;
    if (!insideChart) { setContextMenu(null); return; }
    // لو في رسمة نص التنفيذ ولسا ما اكتملت، كليك يمين بيلغيها بالكامل زي تريدنغ
    // فيو، وما بيفتح قائمة الشراء/البيع نهائياً بهاي الحالة
    const midDrawing = !!(isDrawingRef.current && drawStateRef.current) || pathPointsRef.current.length > 0;
    if (midDrawing) {
      isDrawingRef.current = false;
      drawStateRef.current = null;
      pathPointsRef.current = [];
      liveCursorRef.current = null;
      setActiveTool("cursor");
      scheduleDraw();
      setContextMenu(null);
      return;
    }
    const { price } = getLogicalPriceGlobal(clientX, clientY);
    const x = clientX - areaRect.left;
    const y = clientY - areaRect.top;
    setContextMenu({ x, y, price: price != null ? price : null });
  }
  // القائمة لازم تقفل تلقائياً عند تغيير الأداة المفعّلة أو الفريم الحالي
  useEffect(() => { closeTransientMenus(); }, [activeTool]);
  useEffect(() => { closeTransientMenus(); }, [interval]);
  // تغيير الرمز (الأصل) بيسكّر القوائم المؤقتة المفتوحة كمان
  useEffect(() => { closeTransientMenus(); }, [assetValue]);

  function openQuickTrade(direction, priceOverride) {
    if (!userId) {
      setTradeToast("سجّلي دخول أول عشان تقدري تسجّلي صفقات بالباك تيست");
      return;
    }
    const price = priceOverride != null ? priceOverride : getCurrentPrice();
    if (!price) {
      setTradeToast("ما في سعر متاح لسا، جربي كمان شوي");
      return;
    }
    if (pendingTradeRef.current) {
      drawingsRef.current = drawingsRef.current.filter((d) => d.tradeTag !== pendingTradeRef.current.tag);
    }
    const tag = "trade_" + Date.now();
    const dist = price * 0.003; // مسافة افتراضية 0.3% تبدأ فيها الخطوط، وبعدين تسحبيها لمكان الهدف/وقف الخسارة الصح
    const tp = direction === "buy" ? price + dist : price - dist;
    const sl = direction === "buy" ? price - dist : price + dist;
    const vr = chartRef.current?.timeScale().getVisibleLogicalRange();
    const logical = vr ? vr.to - 2 : (visibleCandlesRef.current.length || 1) - 1;
    // وقت الدخول الحقيقي (timestamp) محسوب من نفس نقطة الـ logical فوق - هاد
    // هو "المرجع الحقيقي" لبداية الصفقة، وبيضل ثابت حتى لو تغيّر الفريم بعدين
    // (تظليل الصفقة وتقييمها التاريخي بيعتمدو عليه، مش على الـ logical نفسه).
    // ملاحظة مهمة: "logical" فوق ممكن يكون أكبر من (عدد الشموع - 1) لأنه
    // مبني على vr.to (حافة المدى المرئي)، ولايتبريت-تشارتس عادة بيسيب فراغ
    // فاضي بعد آخر شمعة حقيقية (يمين الشارت). لو استخدمنا هاد الـ logical
    // مباشرة بـ logicalToTimeForCandles، بيصير extrapolation لقدام الوقت
    // الحقيقي لآخر شمعة (يعني entryTime "بالمستقبل" شوي). وهاد بالضبط كان
    // سبب صفقات ما بتنقفل مع وصول الهدف: evaluateOpenPositionsFull بتدوّر
    // عن أول شمعة زمنها >= entryTime، فلو entryTime مستقبلي بالغلط، بتتخطى
    // كل الشموع الحقيقية يلي صارت بين لحظة الدخول الفعلية وهاد الوقت الوهمي
    // - حتى لو وحدة منهم لمست الهدف فعلاً. فمنقصّ الـ logical هون (بس لحساب
    // entryTime، مش لموضع الرسمة نفسها) لأقصى (عدد الشموع - 1) عشان entryTime
    // ما يتجاوز أبداً آخر شمعة حقيقية معروفة وقت الدخول.
    const entryLogical = allCandles.length ? Math.min(logical, allCandles.length - 1) : logical;
    const entryTime = logicalToTimeForCandles(entryLogical, allCandles);

    drawingsRef.current.push({
      id: Date.now(), type: "hline", p1: ptFromLogical(logical, price),
      style: { color: chartSettings.tradeEntryColor || GOLD_LIGHT, width: 1, dash: "solid" }, tradeTag: tag, tradeRole: "entry", entryTime,
    });
    drawingsRef.current.push({
      id: Date.now() + 1, type: "hline", p1: ptFromLogical(logical, tp),
      style: { color: chartSettings.tradeTpColor || GREEN, width: 1.5, dash: "dashed" }, tradeTag: tag, tradeRole: "tp",
    });
    drawingsRef.current.push({
      id: Date.now() + 2, type: "hline", p1: ptFromLogical(logical, sl),
      style: { color: chartSettings.tradeSlColor || RED, width: 1.5, dash: "dashed" }, tradeTag: tag, tradeRole: "sl",
    });
    scheduleDraw();
    setTradeLot("0.01");
    setTradeReason("");
    setPendingTrade({ tag, direction, entry: price, asset: assetValue, entryTime });
  }

  /* بتزامن حقول الكتابة (دخول/هدف/إيقاف) مع الخطوط المرسومة عالشارت، أول ما تنفتح صفقة جديدة
     أو أول ما ينسحب أحد الخطوط باليد - إلا إذا كان المستخدم عم يكتب هلأ بنفس الحقل (منمنع
     قفزة المؤشر وقت الكتابة) */
  useEffect(() => {
    if (!pendingTrade) return;
    if (!entryFocusedRef.current) setEntryText(pendingTrade.entry != null ? pendingTrade.entry.toFixed(2) : "");
    const tpLine = drawingsRef.current.find((d) => d.tradeTag === pendingTrade.tag && d.tradeRole === "tp");
    const slLine = drawingsRef.current.find((d) => d.tradeTag === pendingTrade.tag && d.tradeRole === "sl");
    if (!tpFocusedRef.current) setTpText(tpLine ? tpLine.p1.price.toFixed(2) : "");
    if (!slFocusedRef.current) setSlText(slLine ? slLine.p1.price.toFixed(2) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTrade, dragTick]);

  /* تعديل سعر الدخول/الهدف/الإيقاف كتابياً من نفس لوحة تأكيد الصفقة - بيحرّك الخط المطابق
     عالشارت لحظياً بدل ما يضطر المستخدم يسحبه باليد */
  function updatePendingTradeLevel(role, num) {
    const pt = pendingTradeRef.current;
    if (!pt || isNaN(num)) return;
    if (role === "entry") {
      const idx = drawingsRef.current.findIndex((d) => d.tradeTag === pt.tag && d.tradeRole === "entry");
      if (idx !== -1) drawingsRef.current[idx] = { ...drawingsRef.current[idx], p1: { ...drawingsRef.current[idx].p1, price: num } };
      setPendingTrade((p) => (p ? { ...p, entry: num } : p));
    } else {
      const idx = drawingsRef.current.findIndex((d) => d.tradeTag === pt.tag && d.tradeRole === role);
      if (idx !== -1) drawingsRef.current[idx] = { ...drawingsRef.current[idx], p1: { ...drawingsRef.current[idx].p1, price: num } };
    }
    scheduleDraw();
    setDragTick((t) => t + 1);
  }
  function handleEntryTextChange(v) {
    setEntryText(v);
    const num = parseFloat(v);
    if (!isNaN(num)) updatePendingTradeLevel("entry", num);
  }
  function handleTpTextChange(v) {
    setTpText(v);
    const num = parseFloat(v);
    if (!isNaN(num)) updatePendingTradeLevel("tp", num);
  }
  function handleSlTextChange(v) {
    setSlText(v);
    const num = parseFloat(v);
    if (!isNaN(num)) updatePendingTradeLevel("sl", num);
  }

  /* بتزامن حقول تعديل هدف/إيقاف الصفقات المفتوحة مع القيم الفعلية - إلا إذا كان
     المستخدم عم يكتب هلأ بنفس الحقل */
  useEffect(() => {
    setOpenPosEdits((prev) => {
      const next = { ...prev };
      for (const pos of openPositionsList) {
        const tpFocused = openPosFocusRef.current[pos.dbId + "_tp"];
        const slFocused = openPosFocusRef.current[pos.dbId + "_sl"];
        next[pos.dbId] = {
          tp: tpFocused ? (prev[pos.dbId]?.tp ?? pos.tp.toFixed(2)) : pos.tp.toFixed(2),
          sl: slFocused ? (prev[pos.dbId]?.sl ?? pos.sl.toFixed(2)) : pos.sl.toFixed(2),
        };
      }
      return next;
    });
  }, [openPositionsList]);

  function cancelQuickTrade() {
    if (pendingTradeRef.current) {
      drawingsRef.current = drawingsRef.current.filter((d) => d.tradeTag !== pendingTradeRef.current.tag);
      scheduleDraw();
    }
    setTradeReason("");
    setPendingTrade(null);
  }

  async function confirmQuickTrade() {
    const pt = pendingTradeRef.current;
    if (!pt || !userId) return;
    if (!tradeReason.trim()) {
      setTradeToast("لازم تكتبي سبب الدخول قبل ما تسجّلي الصفقة");
      return;
    }
    const tpLine = drawingsRef.current.find((d) => d.tradeTag === pt.tag && d.tradeRole === "tp");
    const slLine = drawingsRef.current.find((d) => d.tradeTag === pt.tag && d.tradeRole === "sl");
    const lot = parseFloat(tradeLot) || 0.01;
    const info = getAssetByValue(pt.asset);
    const mult = info?.mult || 1;
    const tp = tpLine?.p1.price ?? pt.entry;
    const sl = slLine?.p1.price ?? pt.entry;
    const riskAmount = Math.abs(pt.entry - sl) * lot * mult;
    const rewardAmount = Math.abs(tp - pt.entry) * lot * mult;
    const rr = riskAmount > 0 ? rewardAmount / riskAmount : 0;
    const riskPercent = accountBalance > 0 ? (riskAmount / accountBalance) * 100 : 0;

    setSavingTrade(true);
    const row = tradeToRow({
      asset: pt.asset,
      date: new Date().toISOString().slice(0, 10),
      direction: pt.direction,
      lot, entry: pt.entry, sl, tp,
      result: "pending",
      setup: "من الاستعراض التاريخي",
      reason: tradeReason.trim(),
      riskAmount, rewardAmount, rr, riskPercent,
      isLive: mode === "live",
      // لازم نبعت priceSource/sourceSymbol هون بالظبط متل ما بتعمل أداة الباك تيست،
      // وإلا صفقات "مباشر" المفتوحة من الاستعراض التاريخي بتضل بدون مصدر سعر،
      // فبتظهر دايماً "⚠️ خطأ" بعمود السعر الحالي بالباك تيست ومتابعتها الحية
      // بتفشل فوراً بدون أي طلب شبكة (أصل غير مدعوم للمتابعة الحية).
      priceSource: mode === "live" ? "yahoo" : null,
      sourceSymbol: mode === "live" ? info?.yahoo || null : null,
    }, userId);

    const { data, error } = await supabase.from("trades").insert(row).select().single();
    setSavingTrade(false);
    if (error) {
      setTradeToast("صار خطأ بتسجيل الصفقة: " + error.message);
      return;
    }
    // نحوّل الخطوط لصفقة "مفتوحة" مراقَبة بدل ما نمسحها، عشان تنقفل تلقائي لما يلمس السعر الهدف أو الإيقاف
    openPositionsRef.current.push({
      dbId: data.id, tag: pt.tag, direction: pt.direction, entry: pt.entry, sl, tp, lot,
      riskAmount, rewardAmount, asset: pt.asset, entryTime: pt.entryTime,
    });
    setOpenPositionsList([...openPositionsRef.current]);
    setPendingTrade(null);
    setTradeToast(`✅ اتسجلت صفقة ${pt.direction === "buy" ? "شراء" : "بيع"} — بتلاقيها بالباك تيست ولوحة التحكم`);
  }

  /* ===== حفظ سيناريو تمرين + مفتاح الإجابة (وضع الأدمن فقط) ===== */
  const ROLE_LABELS = {
    structure: "الهيكلية",
    poi: "منطقة/مستوى اهتمام (POI)",
    smt: "SMT",
    cisd: "CISD",
    entry: "الدخول",
    stop: "الستوب",
  };

  function taggedDrawings() {
    return drawingsRef.current.filter((d) => drawingRoles[d.id]?.role);
  }

  function logicalRangeOf(d) {
    const points = [d.p1, d.p2, ...(d.points || [])].filter(Boolean);
    const logicals = points.map((p) => ptToLogical(p)).filter((v) => v != null);
    if (!logicals.length) return { start: null, end: null };
    return { start: Math.min(...logicals), end: Math.max(...logicals) };
  }

  async function saveScenarioAndAnswerKey() {
    if (!isAdmin || !userId || !supabase) return;
    const tagged = taggedDrawings();
    if (!scenarioForm.title.trim()) {
      setScenarioSaveToast("لازم تكتب عنوان للسيناريو أول");
      return;
    }
    if (tagged.length === 0) {
      setScenarioSaveToast("لازم تحدد دور (role) لرسمة واحدة عالأقل قبل الحفظ");
      return;
    }
    setSavingScenario(true);
    try {
      const firstCandle = allCandles[0];
      const lastCandle = allCandles[allCandles.length - 1];
      const { data: scenario, error: scenarioError } = await supabase
        .from("practice_scenarios")
        .insert({
          title: scenarioForm.title.trim(),
          description: scenarioForm.description.trim() || null,
          asset: assetValue,
          interval,
          date_from: firstCandle ? new Date(firstCandle.time * 1000).toISOString() : new Date().toISOString(),
          date_to: lastCandle ? new Date(lastCandle.time * 1000).toISOString() : new Date().toISOString(),
          difficulty: scenarioForm.difficulty,
          is_published: false,
          created_by: userId,
        })
        .select()
        .single();

      if (scenarioError) throw scenarioError;

      const rows = tagged.map((d, idx) => {
        const meta = drawingRoles[d.id];
        const { start, end } = logicalRangeOf(d);
        return {
          scenario_id: scenario.id,
          role: meta.role,
          drawing: d,
          candle_index_start: start,
          candle_index_end: end,
          price_tolerance: meta.price_tolerance ?? 0.5,
          candle_tolerance: meta.candle_tolerance ?? 2,
          weight: meta.weight ?? 20,
          notes: meta.notes || null,
          order_index: idx,
        };
      });

      const { error: keysError } = await supabase.from("practice_answer_keys").insert(rows);
      if (keysError) throw keysError;

      setScenarioSaveToast(`✅ اتحفظ السيناريو "${scenarioForm.title}" مع ${rows.length} عنصر بمفتاح الإجابة (غير منشور لسا)`);
      setScenarioForm({ title: "", description: "", difficulty: "medium" });
      setDrawingRoles({});
    } catch (err) {
      setScenarioSaveToast("صار خطأ: " + (err.message || String(err)));
    } finally {
      setSavingScenario(false);
    }
  }

  async function closeOpenPosition(pos, result, closePrice) {
    openPositionsRef.current = openPositionsRef.current.filter((p) => p.dbId !== pos.dbId);
    setOpenPositionsList([...openPositionsRef.current]);
    drawingsRef.current = drawingsRef.current.filter((d) => d.tradeTag !== pos.tag);
    scheduleDraw();
    setTradeToast(
      result === "win"
        ? `🎯 توصلت للهدف — الصفقة اتقفلت ربح`
        : `⛔ توصلت للإيقاف — الصفقة اتقفلت خسارة`
    );
    if (!supabase || !userId) return;
    await supabase
      .from("trades")
      .update({ result, reason: `إغلاق تلقائي من الاستعراض التاريخي عند ${closePrice.toFixed(2)}` })
      .eq("id", pos.dbId)
      .eq("user_id", userId);
  }

  /* ===== تقييم الصفقات المفتوحة (Trade Evaluation) =====
     بدل ما نعتمد بس على آخر سعر ظاهر (يلي بيخليها تنتظر ضغطة Play)، هون
     منمسح كل الشموع المعروفة من وقت الدخول (entryTime) لحد آخر شمعة وصلها
     الـ Replay حالياً، ومنحدّد أول مستوى (SL أو TP) اتلمس زمنياً. هيك الصفقة
     بتتقيّم صح فوراً حتى لو غيّرنا الفريم أو رجعنا لفريم سابق بدون تشغيل.

     المقارنة بتستخدم High/Low الشمعة (مش بس Close) + تسامح نسبي صغير
     (priceTolerance) عشان مشاكل دقة الفاصلة العائمة ما تمنع الإغلاق. */
  function evaluateOpenPositionsFull(knownCandles) {
    if (!knownCandles || !knownCandles.length || openPositionsRef.current.length === 0) return;
    for (const pos of [...openPositionsRef.current]) {
      // صفقات قديمة اتفتحت قبل هالتحديث وما عندها entryTime مسجّل - منسيبها
      // على منطق المراقبة اللحظية القديم (checkOpenPositionsRef) بدل ما نخمّن وقتها
      if (pos.entryTime == null) continue;
      let startIdx = knownCandles.findIndex((c) => c.time >= pos.entryTime);
      if (startIdx === -1) continue; // لسا ما وصلنا وقت الدخول بالبيانات المعروضة حالياً
      for (let i = startIdx; i < knownCandles.length; i++) {
        const c = knownCandles[i];
        const hitSl = pos.direction === "buy" ? lteWithTolerance(c.low, pos.sl) : gteWithTolerance(c.high, pos.sl);
        const hitTp = pos.direction === "buy" ? gteWithTolerance(c.high, pos.tp) : lteWithTolerance(c.low, pos.tp);
        // نفس الشمعة وصلت للهدف والإيقاف مع بعض وما عنا بيانات داخل الشمعة (intrabar):
        // قاعدة ثابتة محافظة ومطبّقة بشكل موحّد بكل مكان بالكود - وقف الخسارة
        // إله الأولوية دايماً (بفحص hitSl قبل hitTp)، وبتنقفل على نفس الشمعة
        // يلي لمست فيها السعر الأول (مش شمعة لاحقة أبداً).
        if (hitSl) { closeOpenPosition(pos, "loss", pos.sl); break; }
        if (hitTp) { closeOpenPosition(pos, "win", pos.tp); break; }
      }
    }
  }


  /* تعديل الهدف/وقف الخسارة لصفقة مفتوحة (بعد ما اتأكدت وانسجلت) - بيحرّك الخط المطابق
     عالشارت وبيحدّث المراقبة الحية، وبيحفظ القيمة الجديدة بقاعدة البيانات كمان */
  function updateOpenPositionLevel(pos, role, num) {
    if (isNaN(num)) return;
    const idx = openPositionsRef.current.findIndex((p) => p.dbId === pos.dbId);
    if (idx === -1) return;
    const info = getAssetByValue(openPositionsRef.current[idx].asset);
    const mult = info?.mult || 1;
    const updated = { ...openPositionsRef.current[idx], [role]: num };
    updated.riskAmount = Math.abs(updated.entry - updated.sl) * updated.lot * mult;
    updated.rewardAmount = Math.abs(updated.tp - updated.entry) * updated.lot * mult;
    openPositionsRef.current[idx] = updated;
    setOpenPositionsList([...openPositionsRef.current]);

    const dIdx = drawingsRef.current.findIndex((d) => d.tradeTag === pos.tag && d.tradeRole === role);
    if (dIdx !== -1) drawingsRef.current[dIdx] = { ...drawingsRef.current[dIdx], p1: { ...drawingsRef.current[dIdx].p1, price: num } };
    scheduleDraw();

    if (supabase && userId) {
      const rr = updated.riskAmount > 0 ? updated.rewardAmount / updated.riskAmount : 0;
      const riskPercent = accountBalance > 0 ? (updated.riskAmount / accountBalance) * 100 : 0;
      supabase
        .from("trades")
        .update({
          [role]: num,
          risk_amount: updated.riskAmount,
          reward_amount: updated.rewardAmount,
          rr,
          risk_percent: riskPercent,
        })
        .eq("id", pos.dbId)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) setTradeToast("تعذّر حفظ التعديل: " + error.message);
        });
    }
  }
  function handleOpenPosFieldChange(pos, role, v) {
    setOpenPosEdits((prev) => ({ ...prev, [pos.dbId]: { ...prev[pos.dbId], [role]: v } }));
    const num = parseFloat(v);
    if (!isNaN(num)) updateOpenPositionLevel(pos, role, num);
  }

  /* مراقبة لحظية بسيطة (تيك واحد بدون OHLC) - مستخدمة كخط دفاع ثاني لصفقات
     قديمة بدون entryTime، وللشارت العشوائي/المباشر أثناء اللحظة نفسها قبل ما
     تشتغل evaluateOpenPositionsFull عالشمعة الكاملة. نفس تسامح الدقة العائمة
     ونفس أولوية SL أولاً، عشان يكون سلوك محرك التنفيذ موحّد بكل مكان بالكود. */
  checkOpenPositionsRef.current = function checkOpenPositions(price) {
    if (!price || openPositionsRef.current.length === 0) return;
    for (const pos of [...openPositionsRef.current]) {
      const hitSl = pos.direction === "buy" ? lteWithTolerance(price, pos.sl) : gteWithTolerance(price, pos.sl);
      const hitTp = pos.direction === "buy" ? gteWithTolerance(price, pos.tp) : lteWithTolerance(price, pos.tp);
      if (hitSl) { closeOpenPosition(pos, "loss", pos.sl); continue; }
      if (hitTp) { closeOpenPosition(pos, "win", pos.tp); }
    }
  };

  /* ===================== إنشاء الشارت مرة وحدة ===================== */
  useEffect(() => {
    let cancelled = false;
    async function setup() {
      const { createChart, CrosshairMode } = await import("lightweight-charts");
      if (cancelled || !chartContainerRef.current) return;

      const savedSettings = loadChartSettings();

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: savedSettings.bg },
          textColor: savedSettings.textColor || "#d1d4dc",
          // نفس عائلة الخطوط اللي تريدنغ فيو بتستخدمها بمحاور السعر/الوقت، عشان يصير
          // شكل الأرقام والتسميات أقرب لشكلها هناك
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
        },
        // شبكة خفيفة جداً بدل إخفائها بالكامل - زي خلفية شارت تريدنغ فيو الحقيقي
        // (خطوط باهتة بالكاد تُلاحظ، مش شبكة صارخة) - قابلة للإخفاء/تلوين من الإعدادات
        grid: {
          vertLines: { color: hexToRgba(savedSettings.gridColor, 0.05), style: 0, visible: savedSettings.gridVisible },
          horzLines: { color: hexToRgba(savedSettings.gridColor, 0.05), style: 0, visible: savedSettings.gridVisible },
        },
        watermark: savedSettings.watermarkText
          ? { visible: true, text: savedSettings.watermarkText, color: "rgba(201,162,75,0.12)", fontSize: 48, horzAlign: "center", vertAlign: "center" }
          : { visible: false },
        timeScale: {
          borderColor: "#3a3a3a",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 6,
          barSpacing: 7,
          minBarSpacing: 1.5,
        },
        localization: {
          timeFormatter: formatCrosshairTime,
        },
        rightPriceScale: {
          borderColor: "#3a3a3a",
          scaleMargins: { top: (savedSettings.scaleMarginTop ?? 8) / 100, bottom: (savedSettings.scaleMarginBottom ?? 8) / 100 },
          // نفس ملاحظة أعلى: عرض ثابت مطابق تماماً لعرض عمود الأسعار بشارت المقارنة
          minimumWidth: PRICE_SCALE_WIDTH,
        },
        width: chartContainerRef.current.clientWidth,
        height: 480,
        /* وضع Normal (مش Magnet) عشان مؤشر السعر يصير "+" حر بيتبع الفأرة فعلياً
           بدل ما يلتصق ويقفز لأقرب سعر شمعة. المؤشر نفسه دايماً ظاهر وواضح
           (لون صريح بدون شفافية) زي تريدنغ فيو، والمغناطيس (لما يكون مفعّل)
           بس بيقوّي التصاقه لما يكون قريب فعلاً من سعر شمعة، من غير ما يختفي أبداً. */
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: savedSettings.crosshairColor, width: 1, style: 2, labelBackgroundColor: "#4c525e" },
          horzLine: { color: savedSettings.crosshairColor, width: 1, style: 2, labelBackgroundColor: "#4c525e" },
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: savedSettings.up, downColor: savedSettings.down, borderVisible: false,
        wickUpColor: savedSettings.up, wickDownColor: savedSettings.down,
        // إخفاء خانة آخر سعر (الصندوق + الخط المتقطع) على محور السعر يمين الشارت
        lastValueVisible: false,
        priceLineVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = series;
      rebuildIndicatorSeries();

      const handleResize = () => {
        if (!chartContainerRef.current) return;
        const isFs = !!document.fullscreenElement;
        let totalHeight = 480;
        if (isFs) {
          const headerH = headerRef.current?.offsetHeight || 0;
          // نحسب الارتفاع من المساحة الفعلية المتبقية بالشاشة (بدل رقم ثابت تخميني):
          // نقيس فعلياً الـ margin تحت الهيدر + الـ padding الفوقي/التحتي لصندوق الشارت
          // عشان ما يضل فراغ أو يطلع أي جزء برا الشاشة أياً كان حجم الهيدر.
          const headerMarginBottom = headerRef.current
            ? parseFloat(window.getComputedStyle(headerRef.current).marginBottom) || 0
            : 0;
          let padTop = 0, padBottom = 0;
          if (chartWrapperRef.current) {
            const cs = window.getComputedStyle(chartWrapperRef.current);
            padTop = parseFloat(cs.paddingTop) || 0;
            padBottom = parseFloat(cs.paddingBottom) || 0;
          }
          totalHeight = Math.max(320, window.innerHeight - headerH - headerMarginBottom - padTop - padBottom - 4);
        } else if (chartWrapperRef.current) {
          // نفس فكرة الشاشة الكاملة، بس هون منحسب المساحة المتاحة لغاية آخر الصفحة
          // (مش رقم ثابت 480px) عشان الشارت ياخد كل المساحة المتبقية بالشاشة
          // بالظبط متل تريدنغ فيو، بدل ما يضل فراغ فاضي تحته أو جنبه.
          const rect = chartWrapperRef.current.getBoundingClientRect();
          const cs = window.getComputedStyle(chartWrapperRef.current);
          const padTop = parseFloat(cs.paddingTop) || 0;
          const padBottom = parseFloat(cs.paddingBottom) || 0;
          const BOTTOM_BREATHING_ROOM = 24; // شوي مسافة تحت الشارت قبل نهاية الصفحة
          totalHeight = Math.max(
            420,
            window.innerHeight - rect.top - padTop - padBottom - BOTTOM_BREATHING_ROOM
          );
        }
        // توزيع الارتفاع بين الشارت الرئيسي وشارت المقارنة (لو مفعّل) حسب أي جزء مكبّر حالياً
        // وحسب الحجم اللي المستخدم سحبه يدوياً (قاسم قابل للسحب زي تريدنغ فيو)
        const DIVIDER_H = 10;
        let mainHeight = totalHeight;
        let compareHeight = 0;
        if (compareOpenRef.current) {
          if (maximizedPaneRef.current === "compare") {
            mainHeight = 0;
            compareHeight = totalHeight;
          } else if (maximizedPaneRef.current === "main") {
            mainHeight = totalHeight;
            compareHeight = 0;
          } else {
            const maxCompare = Math.max(100, totalHeight - 150 - DIVIDER_H);
            compareHeight = Math.min(Math.max(100, compareHeightPxRef.current), maxCompare);
            mainHeight = Math.max(150, totalHeight - compareHeight - DIVIDER_H);
          }
        }
        // نفرض ارتفاع صريح بالبكسل على صندوقي اللوحتين نفسهم (مش بس على الشارت جوّاهم).
        // هيك بيضلوا مطابقين تماماً لبعض بغض النظر عن طول أي عنصر جوا اللوحة الرئيسية
        // (زي عمود أدوات الرسم اللي كان بيطوّل أكتر من الشارت ويسيب فراغ أسود تحته).
        if (mainPaneRef.current) mainPaneRef.current.style.height = `${mainHeight}px`;
        if (comparePaneRef.current) comparePaneRef.current.style.height = `${compareHeight}px`;
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: mainHeight,
        });
        // مزامنة قياس الـ overlay canvas مع الشارت (للرسومات)
        if (overlayCanvasRef.current) {
          const rect = chartContainerRef.current.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          overlayCanvasRef.current.width = Math.max(1, rect.width * dpr);
          overlayCanvasRef.current.height = Math.max(1, rect.height * dpr);
          overlayCanvasRef.current.style.width = rect.width + "px";
          overlayCanvasRef.current.style.height = rect.height + "px";
        }
        if (compareChartRef.current && compareContainerRef.current) {
          compareChartRef.current.applyOptions({
            width: compareContainerRef.current.clientWidth,
            height: compareHeight,
          });
        }
        scheduleDraw();
      };
      window.addEventListener("resize", handleResize);
      const handleFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
        setTimeout(handleResize, 50);
      };
      document.addEventListener("fullscreenchange", handleFsChange);

      /* ===== ربط أحداث الرسم على الـ overlay canvas ===== */
      function getLogicalPrice(clientX, clientY) {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return { logical: null, price: null, x: null, y: null };
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const ts = chart.timeScale();
        const logical = ts.coordinateToLogical(x);
        const price = series.coordinateToPrice(y);
        return { logical, price, x, y };
      }
      const MULTI_POINT_COUNT = { wave: 4, fibext: 3, parallelchannel: 3, fibchannel: 3, pitchfork: 3, triangle: 3 };
      function onMouseDown(e) {
        const tool = activeToolRef.current;
        if (tool === "cursor") return; // بوضع المؤشر السحب بيصير من onContainerMouseDownCapture تحت
        // بدء الرسم (أي نقرة بأي أداة غير المؤشر) بيسكّر كل قائمة/نافذة مؤقتة مفتوحة
        closeTransientMenus();
        const { logical, price, y } = getLogicalPrice(e.clientX, e.clientY);
        if (logical == null || price == null) return;
        const snapped = snapPrice(logical, price, y);

        if (tool === "text") {
          const content = window.prompt("اكتبي النص:");
          if (content) {
            pushHistory();
            drawingsRef.current.push({ id: Date.now(), type: "text", p1: ptFromLogical(logical, snapped), text: content, style: styleForNewDrawing("text") });
          }
          setActiveTool("cursor");
          scheduleDraw();
          return;
        }
        if (tool === "hline" || tool === "hray" || tool === "vline" || tool === "crossline") {
          pushHistory();
          const newId = Date.now();
          drawingsRef.current.push({ id: newId, type: tool, p1: ptFromLogical(logical, snapped), style: styleForNewDrawing(tool) });
          setActiveTool("cursor");
          selectDrawing(newId); // نقاط التحكم تظهر تلقائياً فوراً بعد إنشاء الأداة
          scheduleDraw();
          return;
        }
        if (tool === "path" || tool === "wave" || tool === "fibext" || tool === "parallelchannel" || tool === "fibchannel" || tool === "pitchfork" || tool === "triangle") {
          pathPointsRef.current.push({ logical, price: snapped });
          const need = MULTI_POINT_COUNT[tool];
          if (need && pathPointsRef.current.length >= need) {
            finishMultiPoint(); // finishMultiPoint نفسها بتعمل pushHistory قبل الإضافة
          }
          scheduleDraw();
          return;
        }
        // نظام النقرات: نقرة أولى تثبّت نقطة البداية وتبلّش معاينة حيّة تتبع الماوس
        // بدون الحاجة لإبقاء الزر مضغوط، ونقرة ثانية عند أي مكان تثبّت الرسمة نهائياً.
        if (isDrawingRef.current && drawStateRef.current && drawStateRef.current.type === tool) {
          const d = drawStateRef.current;
          // Shift مضغوط وقت التثبيت النهائي: نطبّق نفس تقييد الزاوية على النقطة الأخيرة
          d.p2 = shiftPressedRef.current
            ? applyAngleSnap(d.type, d.p1, logical, snapped)
            : { logical, price: snapped };
          drawStateRef.current = null;
          isDrawingRef.current = false;
          if (d.type !== "measure") {
            pushHistory();
            const newId = Date.now();
            // d.p1/d.p2 لسا بصيغة {logical, price} (فضاء تفاعلي مؤقت أثناء الرسم) -
            // نحوّلهن لـ {time, price} هون بالضبط، لحظة التثبيت النهائي بالتخزين
            // الدائم (drawingsRef.current)، عشان تنخزّن كإحداثي سوق مطلق.
            drawingsRef.current.push({
              id: newId, ...d,
              p1: ptFromLogical(d.p1.logical, d.p1.price),
              p2: ptFromLogical(d.p2.logical, d.p2.price),
            });
            setActiveTool("cursor");
            selectDrawing(newId); // نقاط التحكم (Anchors) تظهر تلقائياً فوراً بعد إنشاء الرسمة
          } else {
            setActiveTool("cursor");
          }
          scheduleDraw();
          return;
        }
        drawStateRef.current = { type: tool, p1: { logical, price: snapped }, p2: { logical, price: snapped }, style: styleForNewDrawing(tool) };
        isDrawingRef.current = true;
        scheduleDraw();
      }
      function onMouseMove(e) {
        // وضع المؤشر: تلوين مؤشر الفأرة لما يكون فوق رسمة (يد) عشان يبين إنها قابلة للسحب،
        // وتحديث موقع الرسمة إذا كان في سحب جاري حالياً
        if (activeToolRef.current === "cursor") {
          if (cutMode) return; // أداة القص عم تتحكم بمؤشر الفأرة والتفاعل بنفسها (شوفي useEffect الخاص فيها تحت)
          if (dragStateRef.current) {
            const st = dragStateRef.current;
            const { logical, price, y } = getLogicalPrice(e.clientX, e.clientY);
            if (logical == null || price == null) return;
            const d = drawingsRef.current.find((dr) => dr.id === st.id);
            if (!d) return;
            if (st.mode === "move") {
              const dLogical = logical - st.lastLogical;
              const dPrice = price - st.lastPrice;
              moveDrawingBy(d, dLogical, dPrice);
              st.lastLogical = logical;
              st.lastPrice = price;
            } else if (st.mode === "handle") {
              const snapped = snapPrice(logical, price, y);
              setHandlePoint(d, st.key, logical, snapped);
            }
            if (d.tradeTag) scheduleDragTickBump();
            scheduleDraw();
            return;
          }
          const { x, y } = getLogicalPrice(e.clientX, e.clientY);
          if (x != null && y != null && chartContainerRef.current) {
            const hit = findHandleAt(x, y) || (findDrawingAt(x, y) ? { key: "body" } : null);
            chartContainerRef.current.style.cursor = hit ? "move" : "default";
          }
          return;
        }
        const activePath = (activeToolRef.current === "path" || activeToolRef.current === "wave" || activeToolRef.current === "fibext" || activeToolRef.current === "triangle") && pathPointsRef.current.length;
        const { logical, price, y } = getLogicalPrice(e.clientX, e.clientY);
        if (logical == null || price == null) return;
        // مغناطيس أثناء الرسم: نحسب السعر الملتصق *قبل* ما نحرك مؤشر التقاطع، ونستخدمه
        // هو (مش السعر الخام) لعرض المؤشر - هيك المغناطيس محسوس وقوي وإحنا عم نرسم،
        // مش بس لما يكون المؤشر حر بدون أداة رسم مفعّلة.
        const toolActive = activeToolRef.current !== "cursor";
        const snapped = toolActive ? snapPrice(logical, price, y) : price;
        // نخلي مؤشر التقاطع (+) الأصلي يضل ظاهر وهو عم يتحرك حتى وإحنا نستخدم أداة رسم،
        // لأن الـ overlay canvas بياخد كل أحداث الماوس فوقه فما بيوصل حدث mousemove
        // للشارت الأصلي (يلي هو المسؤول عن رسم مؤشر التقاطع)
        const idx = Math.round(logical);
        const barForCrosshair = visibleCandlesRef.current[idx];
        if (barForCrosshair) {
          chart.setCrosshairPosition(snapped, barForCrosshair.time, series);
          syncCrosshairToCompare(barForCrosshair.time);
        }
        if (!isDrawingRef.current && !activePath) return;
        if (isDrawingRef.current && drawStateRef.current) {
          drawStateRef.current.p2 = shiftPressedRef.current
            ? applyAngleSnap(drawStateRef.current.type, drawStateRef.current.p1, logical, snapped)
            : { logical, price: snapped };
        }
        if (activePath) {
          liveCursorRef.current = { logical, price: snapped };
        }
        scheduleDraw();
      }
      function onMouseUp() {
        // ما عاد في تثبيت بالسحب/الإفلات — الرسم صار بنظام نقرة ثم نقرة (كليك ثم كليك)،
        // فهون بس منسكّر سحب الرسومات الموجودة بوضع المؤشر (تحريك/تعديل نقاط رسمة قائمة).
        if (dragStateRef.current) {
          const draggedId = dragStateRef.current.id;
          const d = drawingsRef.current.find((dr) => dr.id === draggedId);
          dragStateRef.current = null;
          chart.applyOptions({ handleScroll: true, handleScale: true });
          // إذا الخط يلي انسحب كان هدف/إيقاف لصفقة مفتوحة (مش صفقة لسا معلّقة)، منحدّث
          // قيمتها الفعلية بالمراقبة الحية ومنحفظها بقاعدة البيانات كمان
          if (d && d.tradeTag && (d.tradeRole === "tp" || d.tradeRole === "sl")) {
            const pos = openPositionsRef.current.find((p) => p.tag === d.tradeTag);
            if (pos) updateOpenPositionLevel(pos, d.tradeRole, d.p1.price);
          }
          scheduleDraw();
        }
      }
      /* سحب رسمة موجودة بوضع المؤشر: نمسك الحدث بمرحلة الـ capture قبل ما يوصل لمكتبة
         الشارت (اللي بتستخدمه للتحريك/الزوم)، فإذا كان في رسمة تحت المؤشر منوقف التحريك
         الافتراضي للشارت ومنبلش سحب الرسمة، وإلا منسيب الحدث يكمل طبيعي (بان/زوم عادي) */
      function onContainerMouseDownCapture(e) {
        if (activeToolRef.current !== "cursor" || e.button !== 0) return;
        const { logical, price, x, y } = getLogicalPrice(e.clientX, e.clientY);
        if (x == null || y == null) return;
        const handleHit = findHandleAt(x, y);
        if (handleHit) {
          e.preventDefault();
          e.stopPropagation();
          selectDrawing(handleHit.drawing.id);
          if (handleHit.drawing.locked) { scheduleDraw(); return; }
          if (!handleHit.drawing.tradeTag) pushHistory();
          dragStateRef.current = { mode: "handle", id: handleHit.drawing.id, key: handleHit.key };
          chart.applyOptions({ handleScroll: false, handleScale: false });
          return;
        }
        const hit = findDrawingAt(x, y);
        if (hit) {
          e.preventDefault();
          e.stopPropagation();
          selectDrawing(hit.id);
          if (hit.locked) { scheduleDraw(); return; }
          if (!hit.tradeTag) pushHistory();
          dragStateRef.current = { mode: "move", id: hit.id, lastLogical: logical, lastPrice: price };
          chart.applyOptions({ handleScroll: false, handleScale: false });
          return;
        }
        clearSelection();
        closeTransientMenus();
      }
      function onKeyDown(e) {
        if (e.key === "Shift") shiftPressedRef.current = true;
        const typing = isEditableTarget(document.activeElement);
        if (e.key === "Escape") {
          isDrawingRef.current = false;
          drawStateRef.current = null;
          pathPointsRef.current = [];
          liveCursorRef.current = null;
          if (dragStateRef.current) {
            dragStateRef.current = null;
            chart.applyOptions({ handleScroll: true, handleScale: true });
          }
          clearSelection();
          closeTransientMenus();
          setActiveTool("cursor");
          scheduleDraw();
          return;
        }
        if (e.key === "Enter" && activeToolRef.current === "path" && pathPointsRef.current.length >= 2) {
          finishMultiPoint();
          return;
        }
        // اختصارات لوحة المفاتيح التالية (تراجع/إعادة/حذف) لازم تتجاهل الكتابة
        // العادية جوا حقول الإدخال (نص/رقم/textarea...إلخ)
        if (typing) return;
        if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
          e.preventDefault();
          if (e.shiftKey) performRedo(); else performUndo();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
          e.preventDefault();
          performRedo();
          return;
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          // إذا في رسمة محددة حالياً: نحذفها فوراً بدون تأكيد (بالضبط متل تريدنغ فيو)
          // - وإلا (ما في شي محدد) منسيب Backspace يشتغل بسلوكه الافتراضي بالمتصفح
          if (selectedIdRef.current != null) {
            e.preventDefault();
            deleteSelectedDrawing(); // هاي نفسها بتعمل pushHistory قبل الحذف
          }
        }
      }
      function onKeyUp(e) {
        if (e.key === "Shift") shiftPressedRef.current = false;
      }
      function onWindowBlurResetShift() {
        // لو المستخدم بدّل تبويب/نافذة وهو ماسك Shift، منضمن رجوعه لحالته الطبيعية
        shiftPressedRef.current = false;
      }
      function onDblClickOverlay() {
        if (activeToolRef.current === "path" && pathPointsRef.current.length >= 2) {
          finishMultiPoint();
        }
      }
      function onContainerDblClick(e) {
        if (activeToolRef.current !== "cursor") return;
        const { x, y } = getLogicalPrice(e.clientX, e.clientY);
        if (x == null || y == null) return;
        const hit = findDrawingAt(x, y);
        if (hit && !hit.tradeTag) openProperties(hit);
      }
      /* كليك يمين عالشارت: قائمة سياق (نسخ السعر، شراء/بيع فوري، إعدادات الألوان، إلخ) */
      function onContextMenu(e) {
        e.preventDefault();
        openContextMenuAt(e.clientX, e.clientY);
      }

      /* ===== Zoom/Pan أثناء الرسم =====
         لما تكون أداة رسم مفعّلة (activeTool != cursor)، الـ overlay canvas
         بياخد كل أحداث الماوس (pointerEvents:auto) عشان يسمح برسم دقيق، وهاد
         كان يمنع أي تكبير/تصغير أو تحريك للشارت لحد ما تخلصي الرسم. هون منعيد
         توجيه العجلة (wheel) والسحب بالزر الأوسط يدوياً لمكتبة الشارت، بدون
         ما نلمس أحداث الزر الشمال (يلي مسؤولة عن تثبيت نقاط الرسم) أو الزر
         اليمين (يلي مسؤولة عن الإلغاء). الإحداثيات نفسها (logical + price)
         ما بتتأثر أبداً بالزوم/البان لأنها مرتبطة بالبيانات مش بمكان البكسل،
         فالرسم الجاري بيضل مثبّت صح بعد أي زوم. */
      function onOverlayWheel(e) {
        if (activeToolRef.current === "cursor") return; // بوضع المؤشر، الشارت نفسه بيتكفل بعجلة الزوم عادي
        e.preventDefault();
        const ts = chart.timeScale();
        const vr = ts.getVisibleLogicalRange();
        if (!vr) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          // تحريك أفقي (تراك باد بإصبعين، أو Shift+عجلة)
          const span = vr.to - vr.from;
          const shift = (e.deltaX / 100) * span * 0.08;
          ts.setVisibleLogicalRange({ from: vr.from + shift, to: vr.to + shift });
        } else {
          // تكبير/تصغير حول موضع المؤشر الحالي
          const { logical } = getLogicalPrice(e.clientX, e.clientY);
          const center = logical != null ? logical : (vr.from + vr.to) / 2;
          const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
          const newFrom = center - (center - vr.from) * factor;
          const newTo = center + (vr.to - center) * factor;
          if (newTo - newFrom >= 2) ts.setVisibleLogicalRange({ from: newFrom, to: newTo });
        }
        scheduleDraw();
      }
      let panDrag = null;
      function onOverlayAuxDown(e) {
        if (e.button !== 1 || activeToolRef.current === "cursor") return; // الزر الأوسط بس، وأثناء الرسم فقط
        e.preventDefault();
        const vr0 = chart.timeScale().getVisibleLogicalRange();
        if (!vr0) return;
        panDrag = { startX: e.clientX, vr0 };
      }
      function onWindowMouseMoveForPan(e) {
        if (!panDrag) return;
        const ts = chart.timeScale();
        const barSpacing = ts.options()?.barSpacing || 6;
        const dxPx = e.clientX - panDrag.startX;
        const shift = -dxPx / (barSpacing || 6);
        ts.setVisibleLogicalRange({ from: panDrag.vr0.from + shift, to: panDrag.vr0.to + shift });
        scheduleDraw();
      }
      function onWindowMouseUpForPan() { panDrag = null; }

      const overlayEl = overlayCanvasRef.current;
      const containerEl = chartContainerRef.current;
      overlayEl?.addEventListener("wheel", onOverlayWheel, { passive: false });
      overlayEl?.addEventListener("mousedown", onOverlayAuxDown);
      window.addEventListener("mousemove", onWindowMouseMoveForPan);
      window.addEventListener("mouseup", onWindowMouseUpForPan);
      overlayEl?.addEventListener("mousedown", onMouseDown);
      overlayEl?.addEventListener("dblclick", onDblClickOverlay);
      containerEl?.addEventListener("dblclick", onContainerDblClick);
      containerEl?.addEventListener("mousedown", onContainerMouseDownCapture, { capture: true });
      overlayEl?.addEventListener("contextmenu", onContextMenu);
      containerEl?.addEventListener("contextmenu", onContextMenu);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onWindowBlurResetShift);
      chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleDraw);
      chart.subscribeCrosshairMove(scheduleDraw);
      // أي بان أو زوم عالشارت (تغيير المدى المرئي) بيسكّر القوائم المؤقتة المفتوحة،
      // زي أي حدث تاني "بيقفل القوائم عادة" (شوفي closeTransientMenus)
      function onVisibleRangeChangeCloseMenus() { closeTransientMenus(); }
      chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChangeCloseMenus);

      /* خانة السعر الحيّة على محور السعر (زي TradingView): اسم الزوج + السعر
         + الوقت المتبقي لإغلاق الشمعة الحالية. بتتحدث بتيكر دوري بسيط عشان
         تتفادى مشكلة الـ closures القديمة بالبيانات. */
      function updatePriceTag() {
        const el = priceTagRef.current;
        const s = seriesRef.current;
        if (!el || !s) return;
        const list = visibleCandlesRef.current;
        const last = list && list[list.length - 1];
        if (!last) { el.style.display = "none"; return; }
        const y = s.priceToCoordinate(last.close);
        if (y == null) { el.style.display = "none"; return; }
        const up = last.close >= last.open;
        el.style.display = "flex";
        el.style.top = `${y}px`;
        el.style.background = up ? GREEN : RED;
        const symEl = el.querySelector('[data-role="symbol"]');
        const priceEl = el.querySelector('[data-role="price"]');
        const cdEl = el.querySelector('[data-role="countdown"]');
        if (symEl) symEl.textContent = symbolLabelRef.current;
        if (priceEl) priceEl.textContent = last.close.toFixed(2);
        const cd = countdownRef.current;
        if (cdEl) {
          if (cd) { cdEl.style.display = "block"; cdEl.textContent = cd; }
          else { cdEl.style.display = "none"; }
        }
      }
      const priceTagInterval = setInterval(updatePriceTag, 250);

      /* شريط O/H/L/C أعلى الشارت: بيتحدث فوراً لبيانات الشمعة يلي تحت المؤشر
         وقت الـ hover، وبيرجع لآخر شمعة لما الفأرة تطلع برا الشارت. بنحدّثه
         مباشرة بالـ DOM (مش React state) عشان ما نعمل re-render على كل حركة فأرة. */
      function updateOhlcTicker(hoverBar) {
        const list = visibleCandlesRef.current;
        const bar = hoverBar || (list && list[list.length - 1]);
        if (!bar || !ohlcORef.current) return;
        const idx = hoverBar ? list.findIndex((x) => x.time === bar.time) : list.length - 1;
        const prevBar = idx > 0 ? list[idx - 1] : null;
        const up = prevBar ? bar.close >= prevBar.open : bar.close >= bar.open;
        const fmt = (v) => (v != null ? v.toFixed(v < 10 ? 4 : 2) : "-");
        ohlcORef.current.textContent = fmt(bar.open);
        ohlcHRef.current.textContent = fmt(bar.high);
        ohlcLRef.current.textContent = fmt(bar.low);
        ohlcCRef.current.textContent = fmt(bar.close);
        if (ohlcLineRef.current) ohlcLineRef.current.style.color = up ? GREEN : RED;
      }
      // مهم: هاد المؤقّت وظيفته بس إنه يحدّث القيم لآخر شمعة وهي عم تتحرك بالسعر
      // المباشر (وضع "مباشر") لما الفأرة برا الشارت. قبل هيك كان شغّال دايماً
      // كل ٢٥٠ مللي ثانية بغض النظر عن حالة التحويم، فكان "يسحب" القيم يرجع
      // لآخر شمعة كل شوي حتى وانتي واقفة عالمؤشر فوق شمعة تانية - هاد سبب إنه
      // كان صعب/مستحيل تلاحظي المعلومات ثابتة عالشمعة يلي تحت المؤشر. هلأ
      // بيتجاهل نفسه طول ما في تحويم فعلي عالشارت (ohlcHoverActiveRef).
      const ohlcTickerInterval = setInterval(() => {
        if (ohlcHoverActiveRef.current) return;
        updateOhlcTicker(null);
      }, 250);
      function onOhlcHover(param) {
        if (!param.time) {
          ohlcHoverActiveRef.current = false;
          updateOhlcTicker(null);
          return;
        }
        const bar = param.seriesData?.get(series);
        if (bar) {
          ohlcHoverActiveRef.current = true;
          updateOhlcTicker(bar);
        }
      }
      chart.subscribeCrosshairMove(onOhlcHover);

      // مغناطيس خفيف على المؤشر نفسه (مش بس على أدوات الرسم): بيلتصق بأقرب
      // O/H/L/C لما تكوني قريبة منه فعلاً بالبكسل (التصاق واضح بس مش مبالغ فيه)،
      // وبيفضل حر يتبع الفأرة عادي لو بعيدة عنه — بدون ما يختفي المؤشر أبداً.
      // ملاحظة: ما منستخدم clearCrosshairPosition هون إطلاقاً، لأنها هي اللي كانت
      // بتخفي المؤشر بدل ما ترجّعه حر.
      const MAGNET_SNAP_PX = 30; // مغناطيس أقوى (رُفعت الحساسية بناءً على طلب "مغناطيس أقوى")
      let settingCrosshairPos = false;
      function onCrosshairMagnet(param) {
        if (settingCrosshairPos) { settingCrosshairPos = false; return; }
        if (!magnetRef.current) return;
        // Shift مضغوط: تعطيل مؤقت للمغناطيس (نفس فكرة snapPrice فوق)
        if (shiftPressedRef.current) return;
        // المغناطيس بده يشتغل بس وإحنا عم نرسم (أداة رسم مفعّلة فعلياً، مش وضع
        // المؤشر العادي "cursor") - هيك ما بيتدخل بحركة المؤشر الحرة العادية.
        if (activeToolRef.current === "cursor") return;
        if (!param.time || !param.point) return;
        const bar = param.seriesData?.get(series);
        if (!bar) return;
        const vals = [bar.open, bar.high, bar.low, bar.close].filter((v) => v != null);
        let best = null, bestDist = Infinity;
        for (const v of vals) {
          const y = series.priceToCoordinate(v);
          if (y == null) continue;
          const d = Math.abs(param.point.y - y);
          if (d < bestDist) { bestDist = d; best = v; }
        }
        if (best == null || bestDist > MAGNET_SNAP_PX) return; // بعيدة عن أي سعر: يضل حر يتبع الفأرة
        settingCrosshairPos = true;
        chart.setCrosshairPosition(best, param.time, series);
      }
      chart.subscribeCrosshairMove(onCrosshairMagnet);

      /* مزامنة مؤشر تقاطع الوقت/السعر مع لوحة المقارنة (لو مفتوحة) عشان يبانوا
         كأنهم شاشة وحدة زي تريدنغ فيو بالظبط: أي تحريك بالماوس عالشارت الرئيسي
         بيحرك نفس عمود الوقت بلوحة المقارنة تلقائياً، شمعة شمعة.
         ملاحظة مهمة: منستدعيها بشكل مباشر من onMouseMove (مش بس عن طريق
         subscribeCrosshairMove) لأن مؤشر الشارت الرئيسي أصلاً بينترسم يدوياً
         عن طريق setCrosshairPosition، وما في ضمان إنها هي نفسها بتفعّل حدث
         subscribeCrosshairMove بكل نسخ المكتبة — فبالاستدعاء المباشر بنضمن
         إنها تشتغل دايماً. */
      function syncCrosshairToCompare(time) {
        if (crosshairSyncingRef.current) return;
        const cChart = compareChartRef.current;
        const cSeries = compareSeriesRef.current;
        if (!cChart || !cSeries) return;
        crosshairSyncingRef.current = true;
        try {
          if (time == null) {
            cChart.clearCrosshairPosition();
          } else {
            const mainList = visibleCandlesRef.current || [];
            const candles = compareCandlesRef.current || [];
            // مهم: منحاذي بـ"رقم الموضع" (index) مش بأقرب توقيت مطلق. الرمزين
            // (مثلاً NAS100 وSPX500) ممكن يكون عندهم شموع بأوقات مختلفة شوي عن
            // بعض (فجوات/إغلاقات مختلفة)، فمطابقة "أقرب توقيت" كانت بترجّع أحياناً
            // شمعة بموضع مختلف عن يلي تحت الماوس بالضبط بالشارت الرئيسي، فيطلع
            // الخط العمودي بلوحة المقارنة منزاح شوي عن نفس عمود الوقت فوق - وهاد
            // هو سبب مشكلة "تزامن الوقت" يلي كانت بتبان بالمقارنة. رقم الموضع
            // (idx) هو نفسه المستخدم لمزامنة السكرول/الزوم (logical range) بين
            // اللوحتين، فمطابقته هون بتضمن نفس العمود بالبكسل تماماً بكل الحالات.
            let idx = mainList.findIndex((c) => c.time === time);
            let bar = idx !== -1 ? candles[idx] : undefined;
            if (!bar && candles.length) {
              let bestDiff = Infinity;
              for (const c of candles) {
                const diff = Math.abs(c.time - time);
                if (diff < bestDiff) { bestDiff = diff; bar = c; }
              }
            }
            if (bar) cChart.setCrosshairPosition(bar.close, bar.time, cSeries);
            else cChart.clearCrosshairPosition();
          }
        } catch {}
        crosshairSyncingRef.current = false;
      }
      function onMainCrosshairSync(param) {
        syncCrosshairToCompare(param.time ?? null);
      }
      chart.subscribeCrosshairMove(onMainCrosshairSync);

      chart.__cleanup = () => {
        window.removeEventListener("resize", handleResize);
        document.removeEventListener("fullscreenchange", handleFsChange);
        overlayEl?.removeEventListener("wheel", onOverlayWheel);
        overlayEl?.removeEventListener("mousedown", onOverlayAuxDown);
        window.removeEventListener("mousemove", onWindowMouseMoveForPan);
        window.removeEventListener("mouseup", onWindowMouseUpForPan);
        overlayEl?.removeEventListener("mousedown", onMouseDown);
        overlayEl?.removeEventListener("dblclick", onDblClickOverlay);
        containerEl?.removeEventListener("dblclick", onContainerDblClick);
        containerEl?.removeEventListener("mousedown", onContainerMouseDownCapture, { capture: true });
        overlayEl?.removeEventListener("contextmenu", onContextMenu);
        containerEl?.removeEventListener("contextmenu", onContextMenu);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onWindowBlurResetShift);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleDraw);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChangeCloseMenus);
        chart.unsubscribeCrosshairMove(scheduleDraw);
        chart.unsubscribeCrosshairMove(onCrosshairMagnet);
        chart.unsubscribeCrosshairMove(onMainCrosshairSync);

        clearInterval(priceTagInterval);
        clearInterval(ohlcTickerInterval);
        chart.unsubscribeCrosshairMove(onOhlcHover);
      };
      chart.__resize = handleResize;
      handleResize();
    }
    setup();
    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.__cleanup?.();
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        indicatorSeriesRef.current.clear();
      }
    };
  }, []);

  /* ===================== تبديل الشاشة الكاملة ===================== */
  function toggleFullscreen() {
    if (!chartWrapperRef.current) return;
    if (!document.fullscreenElement) {
      chartWrapperRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  /* لما محتوى شريط التحكم العلوي بيتغيّر بوضع الشاشة الكاملة (تبديل وضع/وضع القص/سرعة...)
     ممكن يتغيّر ارتفاعه، فلازم نعيد حساب ارتفاع الشارت عشان شريط الوقت السفلي يضل ظاهر بالكامل */
  useEffect(() => {
    if (isFullscreen) {
      const t = setTimeout(() => chartRef.current?.__resize?.(), 30);
      return () => clearTimeout(t);
    }
  }, [isFullscreen, mode, cutMode, randomChart, assetValue, interval, maxBars, speed, isPlaying, loading]);

  /* لما تنفتح/تنقفل لوحة المقارنة أو ينكبّر أي جزء منها، لازم نعيد توزيع الارتفاع بين الشارتين.
     وكمان لازم نخفي محور الوقت (شريط التواريخ) بالشارت الرئيسي وقتها، عشان يضل
     محور وقت واحد بس ظاهر بالأسفل (بلوحة المقارنة) - بالضبط زي تريدنغ فيو، مش
     محورين منفصلين لكل لوحة. */
  useEffect(() => {
    const t = setTimeout(() => chartRef.current?.__resize?.(), 30);
    if (chartRef.current) {
      const hideMainAxis = compareOpen && maximizedPane !== "main";
      try { chartRef.current.applyOptions({ timeScale: { visible: !hideMainAxis } }); } catch {}
    }
    return () => clearTimeout(t);
  }, [compareOpen, maximizedPane]);

  /* ===================== شارت المقارنة (لوحة سفلية بسيطة للقراءة فقط، بدون أدوات رسم) ===================== */
  useEffect(() => {
    if (!compareOpen) {
      if (compareChartRef.current) {
        compareChartRef.current.remove();
        compareChartRef.current = null;
        compareSeriesRef.current = null;
      }
      return;
    }
    let cancelled = false;
    async function setupCompareChart() {
      const { createChart, CrosshairMode } = await import("lightweight-charts");
      if (cancelled || !compareContainerRef.current) return;
      const savedSettings = loadChartSettings();
      const chart = createChart(compareContainerRef.current, {
        layout: {
          background: { color: savedSettings.bg },
          textColor: savedSettings.textColor || "#d1d4dc",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
        },
        grid: {
          vertLines: { color: hexToRgba(savedSettings.gridColor, 0.05), visible: savedSettings.gridVisible },
          horzLines: { color: hexToRgba(savedSettings.gridColor, 0.05), visible: savedSettings.gridVisible },
        },
        timeScale: { borderColor: "#3a3a3a", timeVisible: true, secondsVisible: false },
        // عرض ثابت مطابق تماماً لعرض عمود الأسعار بالشارت الرئيسي (PRICE_SCALE_WIDTH)،
        // هاد هو الحل الفعلي لمشكلة "آخر شمعة فوق ما بتطابق آخر شمعة تحت بالضبط":
        // كل شارت (رئيسي/مقارنة) هو نسخة lightweight-charts منفصلة، وبدون تثبيت
        // نفس العرض، كل وحدة بتحسب عرض عمود الأسعار تلقائياً حسب عدد خانات
        // السعر تبعها (مثلاً XAUUSD أربع خانات مقابل NAS100 خمس خانات) - فمنطقة
        // رسم الشموع الفعلية ما بتضل بنفس المحاذاة بالبكسل بين اللوحتين حتى لو
        // كانت الفترة الزمنية المعروضة متطابقة 100%.
        rightPriceScale: { borderColor: "#3a3a3a", minimumWidth: PRICE_SCALE_WIDTH },
        // نفس إعدادات مؤشر التقاطع بالضبط زي الشارت الرئيسي (اللون + الوضع Normal)
        // - قبل هيك ما كان في أي إعداد هون، فكان بياخد لون/سلوك افتراضي من
        // المكتبة يختلف عن الشارت الرئيسي (هاد سبب اختلاف لون المؤشر).
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: savedSettings.crosshairColor, width: 1, style: 2, labelBackgroundColor: "#4c525e" },
          horzLine: { color: savedSettings.crosshairColor, width: 1, style: 2, labelBackgroundColor: "#4c525e" },
        },
        width: compareContainerRef.current.clientWidth,
        height: 160,
        // لوحة المقارنة صارت تفاعلية بالكامل (سكرول/زوم مباشر عليها) — التحكم
        // متبادل مع الشارت الرئيسي بالاتجاهين (شوف onMainRangeChange/
        // onCompareRangeChange تحت)، مع حارس (rangeSyncingRef) يمنع أي
        // "تجاذب"/بينغ-بونغ بين اللوحتين لما توصل تحديثات من الاتجاهين
        // بنفس الوقت.
        handleScroll: true,
        handleScale: true,
      });
      const series = buildCompareSeries(chart, loadCompareSettings());
      compareChartRef.current = chart;
      compareSeriesRef.current = series;

      // مزامنة السكرول/الزوم بين الشارت الرئيسي ولوحة المقارنة بالاتجاهين -
      // أي وحدة فيهم ممكن تقود التانية هلأ (قبل هيك كانت لوحة المقارنة "مرآة"
      // بس، ما فيها تحكم مباشر). rangeSyncingRef هو الحارس يلي بيمنع
      // "بينغ-بونغ" (كل شارت يرجع يصحح التاني بلا نهاية): لما وحدة تحدّث
      // التانية، منرفع الحارس قبل ما نغيّر مدى الشارت التاني، وأي حدث تغيير
      // ثاني ناتج عن هالتحديث بنفس اللحظة بيتجاهل نفسه لأنه الحارس مرفوع.
      //
      // مهم: نستخدم مزامنة "منطقية" (logical range = رقم موضع الشمعة) مش
      // مزامنة بالتوقيت المطلق (setVisibleRange). المزامنة بالتوقيت كانت هي
      // سبب مشكلة "الخط العمودي (نقطة الوقت الحالية) مش بنفس المكان بين
      // الشارتين": أي رمزين مختلفين (زي NAS100 وSPX500) ممكن يكون عندهم
      // فجوات/شموع ناقصة بأوقات مختلفة شوي عن بعض، فنفس الفترة الزمنية
      // بالضبط ممكن تترجم لعدد شموع مختلف بكل لوحة، فينزاح كل شي بصرياً حتى
      // لو الفترة "نفسها" بالتوقيت. المزامنة المنطقية بتحاذي برقم موضع
      // الشمعة مباشرة، فعمود رقم N بيضل بنفس البكسل بين اللوحتين دايماً -
      // وهاد هو الأسلوب الموصى فيه رسمياً من مكتبة lightweight-charts
      // لمزامنة عدة شارتات مع بعض.
      const mainChart = chartRef.current;
      const onMainRangeChange = (range) => {
        if (!range || !compareChartRef.current || rangeSyncingRef.current) return;
        rangeSyncingRef.current = true;
        try { compareChartRef.current.timeScale().setVisibleLogicalRange(range); } catch {}
        rangeSyncingRef.current = false;
      };
      const onCompareRangeChange = (range) => {
        if (!range || !chartRef.current || rangeSyncingRef.current) return;
        rangeSyncingRef.current = true;
        try { chartRef.current.timeScale().setVisibleLogicalRange(range); } catch {}
        rangeSyncingRef.current = false;
      };
      mainChart?.timeScale().subscribeVisibleLogicalRangeChange(onMainRangeChange);
      chart.timeScale().subscribeVisibleLogicalRangeChange(onCompareRangeChange);

      // نحاذي لوحة المقارنة فوراً مع نفس الموضع المنطقي للشارت الرئيسي وقت الفتح
      // (بدل ما تضل بفترتها الافتراضية العريضة لحد أول سحب/زوم من المستخدم)
      try {
        const mainRange = mainChart?.timeScale().getVisibleLogicalRange();
        if (mainRange) chart.timeScale().setVisibleLogicalRange(mainRange);
      } catch {}

      /* مزامنة مؤشر تقاطع الوقت/السعر بالاتجاهين (تحريك الماوس فوق أي وحدة من
         اللوحتين بيحرك نفس عمود الوقت بالتانية) - قبل هيك كانت المزامنة
         باتجاه واحد بس (الشارت الرئيسي بيقود)، فلما تكوني تحت (لوحة المقارنة)
         ما كان المؤشر عم يطلع فوق (الشارت الرئيسي). */
      function findNearestBar(candles, time) {
        if (!candles?.length) return null;
        let bar = candles.find((c) => c.time === time);
        if (bar) return bar;
        let bestDiff = Infinity;
        for (const c of candles) {
          const diff = Math.abs(c.time - time);
          if (diff < bestDiff) { bestDiff = diff; bar = c; }
        }
        return bar || null;
      }
      function syncCrosshairToMain(time) {
        if (crosshairSyncingRef.current) return;
        const mChart = chartRef.current;
        const mSeries = seriesRef.current;
        if (!mChart || !mSeries) return;
        crosshairSyncingRef.current = true;
        try {
          if (time == null) {
            mChart.clearCrosshairPosition();
          } else {
            // نفس المبدأ بالاتجاه المعاكس: نلاقي رقم موضع الشمعة تحت الماوس
            // بلوحة المقارنة، ونستخدم نفس الرقم بالشارت الرئيسي (مش أقرب توقيت)
            // عشان الخط العمودي يضل بنفس العمود بالبكسل بين اللوحتين تماماً.
            const compareList = compareCandlesRef.current || [];
            const idx = compareList.findIndex((c) => c.time === time);
            const bar = idx !== -1 ? visibleCandlesRef.current[idx] : findNearestBar(visibleCandlesRef.current, time);
            if (bar) mChart.setCrosshairPosition(bar.close, bar.time, mSeries);
            else mChart.clearCrosshairPosition();
          }
        } catch {}
        crosshairSyncingRef.current = false;
      }
      chart.subscribeCrosshairMove((param) => syncCrosshairToMain(param.time ?? null));

      chart.__unsyncMain = () => {
        mainChart?.timeScale().unsubscribeVisibleLogicalRangeChange(onMainRangeChange);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onCompareRangeChange);
      };

      chartRef.current?.__resize?.();
    }
    setupCompareChart();
    return () => {
      cancelled = true;
      compareChartRef.current?.__unsyncMain?.();
    };
  }, [compareOpen]);

  /* تحديث بيانات شارت المقارنة كل ما تتغيّر الرسمة/الفريم/تقدّم التشغيل (وضع التدريب).
     السبب الحقيقي للفراغ يلي كان بيبان يمين الشارت الرئيسي: بوضع "التدريب" (الريبلاي)
     الشارت الرئيسي بيكون مجمّد على نقطة تاريخية معينة ("اختيار نقطة البداية")
     ومكشوف منه بس شموع لحد هاي النقطة، بينما رمز المقارنة كان دايماً بيجيب ويعرض
     آخر بيانات حية لليوم (لحد اليوم)! يعني اللوحتين أصلاً بيمثلوا فترتين زمنيتين
     مختلفتين تماماً. الحل: نقص بيانات المقارنة لنفس آخر نقطة زمنية مكشوفة
     بالشارت الرئيسي (بوضع التدريب)، تماماً متل ما بنعمل بالشارت الرئيسي نفسه -
     هيك ما ينكشف "مستقبل" لرمز المقارنة قبل ما يوصله الريبلاي. */
  useEffect(() => {
    if (compareSeriesRef.current) {
      let sourceCandles = compareCandles;
      if (mode === "training" && allCandles.length) {
        const cutTime = allCandles[Math.min(revealCount, allCandles.length) - 1]?.time;
        if (cutTime != null) sourceCandles = compareCandles.filter((c) => c.time <= cutTime);
      }
      const data = compareSeriesData(compareSettings.type, sourceCandles);
      try {
        compareSeriesRef.current.setData(data);
        // نحاذي بالموضع المنطقي (logical range) مش بالتوقيت المطلق - نفس السبب
        // المشروح فوق بـ setupCompareChart (تفادي انزياح الخط العمودي بين اللوحتين)
        const mainRange = chartRef.current?.timeScale().getVisibleLogicalRange();
        if (mainRange) compareChartRef.current?.timeScale().setVisibleLogicalRange(mainRange);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareCandles, revealCount, allCandles, mode]);


  /* جلب بيانات رمز المقارنة (نفس مصدر البيانات اللي بتستخدمه أداة الريبلاي - Yahoo Finance) */
  useEffect(() => {
    if (!compareOpen) return;
    let cancelled = false;
    let comparePollTimer = null;
    async function loadCompare() {
      setCompareLoading(true);
      setCompareError("");
      try {
        const info = getAssetByValue(compareSymbol);
        if (!info?.yahoo) throw new Error("هذا الرمز غير مدعوم للمقارنة حالياً");
        const tdInterval = INTERVAL_MAP[interval];
        const tdParam = info.twelveData ? `&td=${encodeURIComponent(info.twelveData)}` : "";
        const res = await fetch(
          `/api/replay-candles?symbol=${encodeURIComponent(info.yahooSpot || info.yahoo)}&interval=${tdInterval}&count=${maxBars}${tdParam}`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const candles = sanitizeCandles(data.candles || []);
        if (cancelled) return;
        setCompareCandles(candles);
      } catch (e) {
        if (!cancelled) { setCompareError(e.message || "تعذّر تحميل بيانات المقارنة"); setCompareCandles([]); }
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    }
    /* تحديث خفيف دوري لبيانات المقارنة بوضع المباشر - قبل هالتعديل كانت لوحة
       المقارنة تُجلب مرة وحدة بس عند الفتح وما تتحدث أبداً بعدها، فمع الوقت
       تصير هي القديمة (نفس مشكلة الشارت الرئيسي بالظبط بس بالاتجاه المعاكس).
       نستخدم count صغير (=3) عشان الطلب يستفيد من liveRangeDays الخفيف
       بالـ API (شوف route.js) وما يثقل على المزوّد. */
    async function pollCompareOnce() {
      try {
        const info = getAssetByValue(compareSymbol);
        if (!info?.yahoo) return;
        const tdInterval = INTERVAL_MAP[interval];
        const tdParam = info.twelveData ? `&td=${encodeURIComponent(info.twelveData)}` : "";
        const res = await fetch(
          `/api/replay-candles?symbol=${encodeURIComponent(info.yahooSpot || info.yahoo)}&interval=${tdInterval}&count=3${tdParam}`
        );
        const data = await res.json();
        if (data.error || !data.candles?.length) return;
        const fresh = sanitizeCandles(data.candles);
        if (fresh.length === 0) return;
        const lastFresh = fresh[fresh.length - 1];
        if (cancelled) return;
        setCompareCandles((prev) => {
          if (prev.length === 0) return prev;
          const merged = [...prev];
          const last = merged[merged.length - 1];
          const bucketSec = (INTERVAL_MS[interval] || 60000) / 1000;
          const sameBar = Math.floor(last.time / bucketSec) === Math.floor(lastFresh.time / bucketSec);
          if (sameBar) {
            merged[merged.length - 1] = lastFresh;
          } else if (lastFresh.time > last.time) {
            merged.push(lastFresh);
          } else {
            return prev;
          }
          return merged;
        });
      } catch (e) {
        console.error("compare live poll failed:", e);
      }
    }
    loadCompare();
    if (mode === "live") {
      // نفس منطق التبطيء بالشارت الرئيسي: لو أصل المقارنة عنده رمز Twelve
      // Data، منبطّئ لـ10 ثواني (بدل 5) حتى لو ضاف على استهلاك الشارت
      // الرئيسي بنفس الوقت (الحد 8 طلبات/دقيقة مشترك لكل مفتاح، مش لكل
      // لوحة) ما يوصلوا سوا لأكتر من الحد بسرعة.
      const compareInfo = getAssetByValue(compareSymbol);
      const compareMs = compareInfo?.twelveData ? 10000 : 5000;
      comparePollTimer = setInterval(pollCompareOnce, compareMs);
    }
    return () => { cancelled = true; if (comparePollTimer) clearInterval(comparePollTimer); };
  }, [compareOpen, compareSymbol, interval, maxBars, mode]);

  function toggleCompare() {
    setCompareOpen((v) => {
      const next = !v;
      if (!next) setMaximizedPane((p) => (p === "compare" ? null : p));
      return next;
    });
  }
  function toggleMaximizePane(pane) {
    setMaximizedPane((p) => (p === pane ? null : pane));
  }
  /* سحب القاسم بين الشارت الرئيسي ولوحة المقارنة لتكبير/تصغير أي منهم يدوياً (زي تريدنغ فيو بالظبط) */
  function onDividerMouseDown(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = compareHeightPxRef.current;
    function onMove(ev) {
      const delta = ev.clientY - startY;
      const next = Math.max(80, startHeight - delta);
      compareHeightPxRef.current = next;
      setCompareHeightPx(next);
      chartRef.current?.__resize?.();
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  /* ===================== جلب البيانات ===================== */
  // رقم تسلسلي لكل استدعاء لـ loadData - عشان لو صار كذا طلب بيانات (fetch) شغال
  // بنفس الوقت (تبديل فريم بسرعة، أو طلب قديم لسا "طاير" ما وصل جوابه بعد)،
  // منتجاهل أي جواب "قديم" يوصل متأخر بعد ما طلب أحدث منه صار وخلص. بدون هيك
  // الحماية، جواب قديم متأخر ممكن يستدعي setAllCandles/pendingReprojectRef
  // ببيانات فريم مختلف تماماً عن الفريم الحالي فعلياً، فتنحسب إعادة إسقاط
  // الرسومات غلط تماماً (نقطة بتاخد وقتها من فريم مش الفريم يلي فعلاً تحول له).
  const loadRequestIdRef = useRef(0);
  const loadData = useCallback(async () => {
    const myRequestId = ++loadRequestIdRef.current;
    stopLivePoll();
    setLoading(true);
    setError("");
    setUsedFuturesApprox(false);
    setIsPlaying(false);

    // نمسح الرسومات/الصفقات بس لما يتغيّر "السوق" فعلياً (الأصل، أو الوضع مباشر/تدريب،
    // أو تفعيل/إلغاء الشارت العشوائي). أما لو تغيّر الفريم بس (أو عدد الشموع الأقصى)
    // فمنحافظ عليها كما هي - مخزّنة بصيغة {time, price} مطلقة أصلاً، فبترتسم
    // صح تلقائياً بالفريم الجديد وقت الرندر (بدون أي معالجة إضافية هون، شوفي
    // ptToLogical فوق بالكومبوننت).
    const prevCtx = lastLoadContextRef.current;
    // انتقال لوضع "تدريب" بسبب قص حديث (finalizeCut عيّنت replayStateRef
    // ومباشرة بعدها setMode("training")) ما لازم يتعامل معاملة "سوق مختلف
    // كلياً" ويمسح نقطة القص - هاد بالضبط كان سبب اختيار نقطة بداية عشوائية
    // بدل نقطة المستخدم يلي قصّت عليها بالضبط (شوفي pickTrainingRevealCount
    // تحت - فرعها "مش نفس السياق" بيختار بداية عشوائية).
    const justCutIntoTraining =
      mode === "training" && replayStateRef.current.isActive && replayStateRef.current.currentTimestamp != null;
    const sameMarketContext =
      prevCtx.hasLoaded &&
      prevCtx.asset === assetValue &&
      prevCtx.randomChart === randomChart &&
      (prevCtx.mode === mode || justCutIntoTraining);
    lastLoadContextRef.current = { asset: assetValue, mode, randomChart, hasLoaded: true };
    if (sameMarketContext) {
      // ملاحظة: نقاط الرسم نفسها ما بتحتاج ولا أي معالجة هون - مخزّنة بصيغة
      // {time, price} مطلقة أصلاً (مش logical)، فبترتسم صح تلقائياً بأي فريم
      // جديد وقت الرندر (شوفي ptToLogical فوق بالكومبوننت). الشي الوحيد يلي
      // فعلاً محتاج "نقل" يدوي هون هو الـ visible logical range (Zoom + Pan) -
      // هاد مو إحداثي بيانات، هو "أي جزء من الشارت ظاهر عالشاشة حالياً"، فمنلقطه
      // *هلق* (لسا الشارت عم يعرض بيانات الفريم القديم بمكانها الطبيعي) عشان
      // نحوّله لاحقاً (logical قديم -> timestamp حقيقي -> logical جديد، نفس
      // تقنية ptToLogical/ptFromLogical) ونرجّع نفس مستوى الزوم/السكرول بعد
      // وصول شموع الفريم الجديد. بدون هيك، setData() الجاي بيرجّع الشارت
      // افتراضياً لآخر الشموع (يمين الشارت) بدل ما يحافظ على نفس المكان.
      const currentVisibleLogicalRange = chartRef.current?.timeScale().getVisibleLogicalRange() || null;
      pendingReprojectRef.current = {
        fromCandles: mode === "training" ? allCandles.slice(0, revealCount) : allCandles,
        fromVisibleLogicalRange: currentVisibleLogicalRange,
      };
    } else {
      drawingsRef.current = [];
      pendingReprojectRef.current = null;
      // سوق مختلف كلياً = ما في داعي نحافظ على حالة Replay قديمة معه
      replayStateRef.current = { isActive: false, anchorTimestamp: null, currentTimestamp: null, originalTimeframe: null };
      setReplayCutTs(null);
    }
    drawStateRef.current = null;
    forceFullReloadRef.current = true;

    // يحدّد نقطة بداية التدريب على مصفوفة الشموع الجديدة: لو في Replay شغال
    // أصلاً بنفس السياق (يعني الفريم بس تغيّر)، منحوّل "الوقت الحقيقي" الحالي
    // تبعه لأقرب شمعة بالفريم الجديد (بدل ما نعتمد على index بيختلف بين
    // الفريمات) - وإلا (أول تحميل/سوق جديد) منستخدم بداية عشوائية زي القديم.
    function pickTrainingRevealCount(candles) {
      if (sameMarketContext && replayStateRef.current.isActive && replayStateRef.current.currentTimestamp != null) {
        const cutTs = replayStateRef.current.currentTimestamp;
        // لازم "آخر شمعة زمنها <= نقطة القص" (مش "أول شمعة زمنها >= نقطة القص"
        // زي قبل). الفرق مو تفصيل بسيط:
        // 1) findIndex(>=) كانت بترجع -1 لو نقطة القص واقعة *جوا* الشمعة
        //    الجارية حالياً بالفريم الجديد (بداية هاي الشمعة قبل نقطة القص،
        //    فما في ولا شمعة "أحدث أو تساويها" فعلياً) - وهاد بالضبط اللي كان
        //    عم يصير كل ما ترجعي لفريم أوسع (H4) بعد قص حديث نسبياً، فكان
        //    الكود القديم يعتبرها "تجاوزت آخر شمعة" ويعرض idx=candles.length-1
        //    = الشارت كامل، فيختفي الـ Cut تماماً (بالضبط الشكوى المذكورة).
        // 2) حتى لو لقت تطابق، findIndex(>=) ممكن ترجع شمعة *بعد* نقطة القص
        //    فعلياً لو ما كان في تطابق تام بالتايم ستامب بين الفريمين (فجوة
        //    سوق/عطلة نهاية أسبوع) - وهاد يخالف الشرط الصريح "ما تظهرش شمعة
        //    بعد نقطة القص".
        // findLastIndex(<=) بيحل الحالتين مع بعض بمنطق واحد وصحيح.
        let idx = -1;
        for (let i = candles.length - 1; i >= 0; i--) {
          if (candles[i].time <= cutTs) { idx = i; break; }
        }
        if (idx === -1) {
          // ولا شمعة وحدة بالفريم الجديد زمنها <= نقطة القص = عمق البيانات
          // المتاحة بهاد الفريم فعلاً ما بيوصل لتاريخ نقطة القص (قيد عمق
          // حقيقي بالمصدر، شوفي rangeDays بـ lib/yahoo-candles.js) - مو
          // "بيانات غير متاحة نهائياً". منبلّغ ومنرجع لسياق طبيعي بدل ما نتيه.
          setTradeToast("⚠️ بيانات هاد الفريم ما بتوصل لتاريخ نقطة القص، تم البدء من أقرب نقطة متاحة");
          suppressAnchorSyncOnceRef.current = true;
          return Math.min(CONTEXT_BARS, candles.length);
        }
        return idx + 1;
      }
      const maxStart = Math.max(CONTEXT_BARS, candles.length - 100);
      const start = Math.floor(Math.random() * (maxStart - CONTEXT_BARS + 1)) + CONTEXT_BARS;
      return Math.min(start, candles.length);
    }

    if (randomChart) {
      const candles = generateRandomCandles(maxBars, interval);
      setAllCandles(candles);
      if (mode === "training") {
        setRevealCount(pickTrainingRevealCount(candles));
      } else {
        setRevealCount(candles.length);
      }
      setLoading(false);
      if (mode === "live") startLivePoll(candles);
      return;
    }

    if (!assetInfo?.yahoo) {
      setError("هذا الأصل غير مدعوم حالياً لعرض الشموع (لا يوجد مصدر بيانات تاريخية له بعد).");
      setAllCandles([]);
      setLoading(false);
      return;
    }

    try {
      const tdInterval = INTERVAL_MAP[interval];
      // لو في نقطة قص/Replay شغالة بنفس السوق، منبعت وقتها كـ anchor عشان
      // السيرفر يجيب مدى تاريخي يضمن يغطيها فعلياً (بدل الاعتماد بس على
      // "آخر X يوم من الآن" واللي ممكن ما توصلها بفريمات دقيقة زي الساعة
      // حتى لو نظرياً المفروض توصل - يوهو نفسه أحياناً ما بيرجّع كل المدى
      // المطلوب لما يكون الطلب من "الآن" للخلف بس).
      const anchorParam =
        sameMarketContext && replayStateRef.current.isActive && replayStateRef.current.currentTimestamp != null
          ? `&anchor=${replayStateRef.current.currentTimestamp}`
          : "";
      const tdParam = assetInfo.twelveData ? `&td=${encodeURIComponent(assetInfo.twelveData)}` : "";
      const dukParam = assetInfo.dukascopy ? `&duk=${encodeURIComponent(assetInfo.dukascopy)}` : "";
      const res = await fetch(
        `/api/replay-candles?symbol=${encodeURIComponent(assetInfo.yahooSpot || assetInfo.yahoo)}&interval=${tdInterval}&count=${maxBars}${anchorParam}${tdParam}${dukParam}`
      );
      const data = await res.json();
      // طلب أحدث صار وخلص قبل ما هاد يوصل جوابه - نتجاهل هاد الجواب "القديم"
      // نهائياً (ما منكمل ولا حتى ما بعد try/catch/finally) عشان ما يفسد
      // allCandles/pendingReprojectRef يلي أصلاً محدَّثين بالطلب الأحدث.
      if (myRequestId !== loadRequestIdRef.current) return;
      if (data.error) throw new Error(data.error);
      const candles = sanitizeCandles(data.candles || []);
      if (candles.length === 0) throw new Error("لا توجد بيانات متاحة لهذا الأصل/الفريم حالياً");
      dataSourceRef.current = {
        symbol: data.sourceSymbol || assetInfo.yahoo,
        usedFallback: false,
        provider: data.provider || "yahoo",
      };
      // ما في عقود آجلة نهائياً بعد اليوم (Yahoo سبوت أو Twelve Data بس) -
      // فهاي العلامة صارت دايماً false، تركناها بالكود بدل حذفها بالكامل
      // عشان لو حابين نرجّعها اختيارياً بالمستقبل ما نعيد بناء المنطق من الصفر.
      setUsedFuturesApprox(false);

      setAllCandles(candles);

      if (mode === "training") {
        setRevealCount(pickTrainingRevealCount(candles));
      } else {
        setRevealCount(candles.length);
        startLivePoll(candles);
      }
    } catch (e) {
      if (myRequestId !== loadRequestIdRef.current) return; // طلب قديم فشل بعد ما تجاوزه طلب أحدث - نتجاهله بصمت
      setError(e.message || "صار خطأ، حاولي مرة تانية");
    } finally {
      if (myRequestId === loadRequestIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetValue, interval, mode, maxBars, randomChart]);

  useEffect(() => {
    // تأخير بسيط (350ms) قبل التحميل الفعلي - لو صار كذا تغيير سريع متتالي
    // (كليكات قص، تبديل فريم/أصل/وضع) قبل ما تخلص هاي الفترة، بننفّذ طلب
    // واحد بس للحالة الأخيرة بدل طلب منفصل لكل تغيير وسيط. هاد يلي كان عم
    // يقصف Twelve Data (حدها 8 طلبات/دقيقة بالخطة المجانية) وقت الاختبار
    // المكثّف ويطلع خطأ "run out of API credits".
    const t = setTimeout(() => { loadData(); }, 350);
    return () => { clearTimeout(t); stopLivePoll(); stopCountdownTick(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData]);

  /* ===================== تحديث الشارت ===================== */
  const prevRevealRef = useRef(0);
  const prevCandlesRef = useRef(null);
  /* علم بيتفعّل مع كل استدعاء loadData() (تبديل وضع/أصل/فريم/رجوع للمباشر بعد
     القص...) عشان نجبر تحديث الشارت الجاي يعمل setData كامل، بدل ما يعتمد بس
     على مقارنة الأطوال (طول المصفوفة القديمة ممكن يطابق الجديدة بالصدفة، زي
     لما ترجعي من التدريب للمباشر، فيغلط ويظنها "تيك حي عادي" ويستخدم update()
     بس عالشمعة الأخيرة، فتضل الشموع القديمة ظاهرة مع شمعة جديدة بعيدة زمنياً
     = فجوة وتعليق بالشارت). */
  const forceFullReloadRef = useRef(false);
  // آخر "سياق سوق" تم التحميل فيه (أصل/وضع/شارت عشوائي) - نقارنه بالسياق الجديد
  // عشان نعرف إذا لازم نمسح الرسومات (سوق مختلف) أو نحافظ عليها (فريم بس تغيّر)
  const lastLoadContextRef = useRef({ asset: null, mode: null, randomChart: null, hasLoaded: false });
  // لما يتغيّر الفريم بس (نفس السوق)، منخزّن هون مصفوفة الشموع "القديمة" +
  // الـ visible logical range مؤقتاً، لحد ما توصل بيانات الفريم الجديد، وقتها
  // منحوّل هاد المدى (Zoom+Pan بس - نقاط الرسم نفسها ما إلها علاقة، شوفي
  // ptToLogical/ptFromLogical فوق) لـ logical مكافئ عالمصفوفة الجديدة (شوفي
  // useLayoutEffect تحت).
  const pendingReprojectRef = useRef(null);
  /* useLayoutEffect لا useEffect: هاي هي نقطة تحديث الشارت الحقيقية (شموع +
     رسومات) رداً على أي تقدّم بالـ Replay (سحب التايم لاين، خطوة تلقائية،
     تيك حي). useEffect العادي بيشتغل بعد ما المتصفح يرسم الفريم (بعد الـ
     paint)، يعني كان ممكن يظهر فريم واحد فيه الـ UI (شريط التقدّم مثلاً)
     محدَّث لكن الشموع لسا القديمة = "قفزة" مرئية قبل ما تصحح حالها بالفريم
     التالي. useLayoutEffect بيشتغل بشكل متزامن قبل الـ paint، فالشموع
     والرسومات بترتسم بنفس الفريم اللي فيه أي تغيير UI تاني، بدون أي وميض. */
  useLayoutEffect(() => {
    if (!seriesRef.current || allCandles.length === 0) return;
    const prevLen = prevCandlesRef.current?.length ?? -1;
    const prevReveal = prevRevealRef.current;
    const forceFullReload = forceFullReloadRef.current;
    forceFullReloadRef.current = false;

    // نقاط الرسم/خطوط الصفقة ما بتحتاج ولا أي إعادة إسقاط هون - مخزّنة بصيغة
    // {time, price} مطلقة، فبترتسم صح تلقائياً بالفريم الجديد وقت الرندر
    // (drawOverlay بيحسب logical كل نقطة live عبر ptToLogical). الشي الوحيد
    // يلي محتاج "نقل" يدوي هون هو الـ visible logical range (Zoom+Pan) -
    // منحوّله (logical قديم -> timestamp حقيقي -> logical جديد) عشان نرجّع
    // نفس مكان الزوم/السكرول بالضبط بعد ما نطبّق setData تحت (بدل ما يرجع
    // الشارت افتراضياً لآخر الشموع يمين الشارت).
    let restoreVisibleRange = null;
    if (pendingReprojectRef.current) {
      const { fromCandles, fromVisibleLogicalRange } = pendingReprojectRef.current;
      pendingReprojectRef.current = null;
      if (fromCandles && fromCandles.length && allCandles.length) {
        const toVisible = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
        if (
          toVisible.length &&
          fromVisibleLogicalRange &&
          Number.isFinite(fromVisibleLogicalRange.from) &&
          Number.isFinite(fromVisibleLogicalRange.to)
        ) {
          const tFrom = logicalToTimeForCandles(fromVisibleLogicalRange.from, fromCandles);
          const tTo = logicalToTimeForCandles(fromVisibleLogicalRange.to, fromCandles);
          if (tFrom != null && tTo != null) {
            const newFrom = timeToLogicalForCandles(tFrom, toVisible);
            const newTo = timeToLogicalForCandles(tTo, toVisible);
            if (Number.isFinite(newFrom) && Number.isFinite(newTo) && newTo > newFrom) {
              restoreVisibleRange = { from: newFrom, to: newTo };
            }
          }
        }
      }
    }

    // وضع التدريب: خطوة وحدة للأمام (تشغيل تلقائي / الشمعة التالية) بنفس مصفوفة الشموع
    const trainingStep = !forceFullReload && mode === "training" && allCandles.length === prevLen && revealCount === prevReveal + 1;
    // وضع السوق الحي: كل بولينغ (كل 5 ثواني) إما بيحدّث آخر شمعة أو بيضيف شمعة جديدة بس
    const liveTick = !forceFullReload && mode === "live" && revealCount === allCandles.length && (allCandles.length === prevLen || allCandles.length === prevLen + 1);

    try {
      if (trainingStep || liveTick) {
        // نضيف/نحدّث الشمعة الأخيرة بس، من دون setData/fitContent
        // عشان ما يصير "رجوع" أو ريست مزعج للزوم والسكرول يلي عم تتفرجي عليه
        seriesRef.current.update(allCandles[revealCount - 1]);
      } else {
        // تحميل بيانات جديدة أو قفزة كبيرة (تبديل وضع/أصل/فريم/بداية عشوائية/قص نقطة/إعادة من البداية)
        seriesRef.current.setData(allCandles.slice(0, revealCount));
        // ملاحظة مهمة: هون كان في fitContent() بيحشر *كل* الشموع المحمّلة
        // (ممكن تكون مئات الشموع اليومية) بعرض الشارت كامل دفعة وحدة - يعني
        // كل شمعة بتاخد أقل من بكسل واحد عرض، فجسم الشمعة (الملوّن) بيختفي
        // عملياً ومابيضل ظاهر غير الفتيل (الخط الرفيع)، فتبان الشموع وكأنها
        // "بارات OHLC" عادية مش شموع يابانية حقيقية - رغم إنها فعلياً
        // candlestick series بالكود (شوفي addCandlestickSeries فوق). حذفنا
        // fitContent() من هون: بدونها، lightweight-charts بيرجع لسلوكها
        // الافتراضي الطبيعي - تعرض آخر عدد شموع يتناسب مع عرض الشارت الحالي
        // بنفس تباعد barSpacing المضبوط (7px)، يعني جسم كل شمعة يبقى ظاهر
        // وواضح بلونه (أخضر/أحمر) بدل ما ينضغط لخط رفيع. المستخدمة لسا فيها
        // خيار "Reset View" (فوق، handleResetView) لو حبّت فعلاً تشوف كل
        // التاريخ مضغوط بشارة واحدة - بس هيك اختيار واعي منها مش افتراضي.
        //
        // استثناء: لو كان في زوم/سكرول محفوظ من قبل تبديل الفريم (restoreVisibleRange
        // فوق)، منطبّقه هون *بدل* إعادة الضبط لـ barSpacing ثابت + يمين الشارت.
        // setVisibleLogicalRange بتحسب barSpacing تلقائياً من عرض الشارت وحجم
        // المدى المطلوب، فبترجع بالضبط نفس مستوى الزوم والمكان يلي كانت فيه
        // المستخدمة قبل ما تبدّل الفريم - تماماً زي سلوك TradingView.
        if (restoreVisibleRange) {
          try {
            chartRef.current?.timeScale().setVisibleLogicalRange(restoreVisibleRange);
          } catch {
            chartRef.current?.timeScale().applyOptions({ barSpacing: 7 });
          }
        } else {
          chartRef.current?.timeScale().applyOptions({ barSpacing: 7 });
        }
      }
    } catch (err) {
      // بيانات فاسدة وصلت رغم التصفية (مصدر خارجي غير متوقع) - نعرض رسالة بدل ما نكسر الصفحة
      console.error("chart data error:", err);
      setError("صار خطأ بعرض بيانات هالفريم، جربي فريم/أصل تاني أو حدّثي الصفحة.");
    }
    // تقييم كامل للصفقات المفتوحة على كل الشموع المعروفة لحد الآن - بغض النظر
    // عن مسار التحديث (تشغيل عادي أو تبديل فريم/أصل كامل)، عشان الصفقة تتقفل
    // فوراً إذا كانت وصلت SL/TP، بدون انتظار ضغطة Play (شوفي TEST 3 بالطلب)
    evaluateOpenPositionsFull(allCandles.slice(0, revealCount));
    recalcAllIndicatorData(allCandles.slice(0, revealCount));
    prevRevealRef.current = revealCount;
    prevCandlesRef.current = allCandles;
    scheduleDraw();
  }, [revealCount, allCandles, mode]);

  /* بتحدّث "الوقت الحالي" لحالة الـ Replay مع كل تقدّم فعلي بالبيانات المكشوفة
     (تشغيل، خطوة يدوية، قص نقطة...)، بغض النظر عن الفريم الحالي. أول مرة
     بتتفعّل بوضع التدريب بتصير هي "نقطة القص" (anchor) تلقائياً. */
  useEffect(() => {
    if (mode !== "training" || !allCandles.length || revealCount < 1) return;
    if (suppressAnchorSyncOnceRef.current) {
      suppressAnchorSyncOnceRef.current = false;
      return;
    }
    const c = allCandles[Math.min(revealCount, allCandles.length) - 1];
    if (!c) return;
    replayStateRef.current.currentTimestamp = c.time;
    if (!replayStateRef.current.isActive) {
      replayStateRef.current.isActive = true;
      replayStateRef.current.anchorTimestamp = c.time;
    }
    replayStateRef.current.originalTimeframe = interval;
    setReplayCutTs(c.time);
  }, [revealCount, allCandles, mode, interval]);

  /* ===================== وضع سوق حي: متابعة الشمعة الحالية بعداد ===================== */
  function stopLivePoll() {
    if (livePollRef.current) clearInterval(livePollRef.current);
    livePollRef.current = null;
    stopCountdownTick();
  }
  function stopCountdownTick() {
    if (countdownTickRef.current) clearInterval(countdownTickRef.current);
    countdownTickRef.current = null;
  }

  function startCountdownTick() {
    stopCountdownTick();
    const tick = () => {
      const { end, stepMs, now } = getCurrentBarWindow(interval);
      const remain = Math.max(0, end - now);
      setCountdown(formatCountdown(remain));
      setCountdownProgress(1 - remain / stepMs);
    };
    tick();
    countdownTickRef.current = setInterval(tick, 1000);
  }

  async function pollLiveOnce() {
    if (randomChart) {
      // بمحاكاة الشارت العشوائي، نولّد حركة سعر بسيطة على آخر شمعة
      setAllCandles((prev) => {
        if (prev.length === 0) return prev;
        const last = { ...prev[prev.length - 1] };
        const vol = last.close * 0.001;
        last.close = Math.max(0.01, last.close + (Math.random() - 0.5) * vol * 2);
        last.high = Math.max(last.high, last.close);
        last.low = Math.min(last.low, last.close);
        const updated = [...prev.slice(0, -1), last];
        seriesRef.current?.update(last);
        updateLivePrice(last.close);
        return updated;
      });
      return;
    }
    if (!assetInfo?.yahoo) return;
    try {
      const tdInterval = INTERVAL_MAP[interval];
      // مهم جداً: البولينغ لازم يضل على *نفس* المصدر يلي نجح فيه التحميل
      // الأول بالضبط (dataSourceRef.current.provider) - مش يعيد تجربة
      // Twelve Data من الصفر كل مرة بشكل مستقل. لو خلطنا بين مصدرين (مثلاً
      // التحميل الأول نجح بيوهو، والبولينغ التالي نجح بـ Twelve Data) ممكن
      // تختلف محاذاة/تاريخ الشمعة اليومية شوي بين المزودين، فيوصل للشارت
      // "شمعة أقدم" من يلي عنده أصلاً - وهاد بالضبط سبب
      // "Cannot update oldest data" اللي كان عم يكسر الشارت. فبنقفل تماماً
      // على نفس المزود المؤكد ناجح، وما منجرب المزود التاني إلا لو المزود
      // الحالي نفسه فشل هالمرة (fallback عادي، مش تبديل قصدي).
      const activeProvider = dataSourceRef.current.provider || "yahoo";
      let pollSymbol, tdParam;
      if (activeProvider === "twelvedata" && assetInfo.twelveData) {
        pollSymbol = assetInfo.yahooSpot || assetInfo.yahoo; // باراميتر symbol إجباري بالراوت حتى لو مش رح يُستخدم فعلياً
        tdParam = `&td=${encodeURIComponent(assetInfo.twelveData)}`;
      } else {
        // المصدر الفعلي الناجح Yahoo سبوت - نضل عليه بدون أي محاولة td هون
        // عشان ما نخلط مصدرين.
        pollSymbol = dataSourceRef.current.symbol || assetInfo.yahooSpot || assetInfo.yahoo;
        tdParam = "";
      }
      const res = await fetch(
        `/api/replay-candles?symbol=${encodeURIComponent(pollSymbol)}&interval=${tdInterval}&count=3${tdParam}`
      );
      const data = await res.json();
      if (data.error || !data.candles?.length) {
        console.error("live poll: empty/error response", data.error);
        handleLivePollFailure();
        return;
      }
      if (data.sourceSymbol)
        dataSourceRef.current = {
          symbol: data.sourceSymbol,
          usedFallback: !!data.usedFallback,
          provider: data.provider || "yahoo",
        };
      const fresh = sanitizeCandles(data.candles);
      if (fresh.length === 0) { handleLivePollFailure(); return; }
      const lastFresh = fresh[fresh.length - 1];

      setAllCandles((prev) => {
        if (prev.length === 0) return prev;
        const merged = [...prev];
        const last = merged[merged.length - 1];
        // مهم: منقارن "هل هاي نفس فترة الفريم الحالية (بار)" مش "هل الثانية
        // مطابقة تماماً". Twelve Data برجّع الشمعة الحية (لسا عم تتكوّن) أحياناً
        // بتوقيت "لحظة الاستعلام" بدل بداية الفترة ثابتة، فكل بولينغ ممكن يرجع
        // فارق كام ثانية بسيط عن المرة اللي قبلها. لو اعتمدنا التطابق التام،
        // كل فرق بسيط هيك كان عم يتفسّر غلط كـ"شمعة جديدة" فتتكوّن سلسلة شموع
        // رفيعة متلاصقة بدل شمعة وحدة طبيعية بتكبر مع الوقت.
        const bucketSec = (INTERVAL_MS[interval] || 60000) / 1000;
        const sameBar = Math.floor(last.time / bucketSec) === Math.floor(lastFresh.time / bucketSec);
        if (sameBar) {
          merged[merged.length - 1] = {
            time: last.time,
            open: last.open,
            high: Math.max(last.high, lastFresh.high, lastFresh.close),
            low: Math.min(last.low, lastFresh.low, lastFresh.close),
            close: lastFresh.close,
          };
        } else if (lastFresh.time > last.time) {
          merged.push(lastFresh);
        } else {
          return prev; // وقت أقدم من عندنا (بيانات غير متسلسلة) - نتجاهله بدل ما نكسر الشارت
        }
        try {
          seriesRef.current?.update(merged[merged.length - 1]);
        } catch (err) {
          console.error("live update error:", err);
        }
        setRevealCount(merged.length);
        return merged;
      });
      forminCandleStartRef.current = lastFresh.time;
      updateLivePrice(lastFresh.close);
      livePollFailCountRef.current = 0; // نجح التحديث - نصفّر عداد الفشل
    } catch (e) {
      console.error("live poll failed:", e);
      handleLivePollFailure();
    }
  }

  /* لو التحديث اللايف الجزئي (pollLiveOnce) فشل عدة مرات متتالية (شبكة/تقييد
     مؤقت من مزوّد البيانات)، منعمل إعادة تحميل كاملة بدل ما نضل نحاول تحديثات
     صغيرة فاشلة للأبد بصمت - هيك الشارت الرئيسي ما يضل "متجمّد" على نقطة قديمة
     بينما لوحة المقارنة (يلي بتنجلب من جديد بشكل مستقل) عم تعرض بيانات أحدث. */
  function handleLivePollFailure() {
    livePollFailCountRef.current += 1;
    if (livePollFailCountRef.current >= 3) {
      livePollFailCountRef.current = 0;
      loadData();
    }
  }

  function startLivePoll(initialCandles) {
    stopLivePoll();
    if (initialCandles?.length) {
      forminCandleStartRef.current = initialCandles[initialCandles.length - 1].time;
      updateLivePrice(initialCandles[initialCandles.length - 1].close);
    }
    startCountdownTick();
    // مهم: ما منستدعي pollLiveOnce() فوراً هون. الشارت لسا ما طبّق البيانات الجديدة
    // كاملة (setData بتصير بـ useEffect منفصل بعد الرندر). لو استدعيناها فوراً ممكن
    // تحاول تحدّث (update) شمعة قبل ما ينضبط الشارت على المجموعة الجديدة، ومكتبة
    // lightweight-charts بترفض هيك تحديث وبتعمل throw exception يكسر الصفحة كلها
    // (هاي كانت سبب مشكلة "شارت عشوائي" اللي بتطلع وقت التبديل بوضع السوق الحي).
    setTimeout(pollLiveOnce, 0);
    // Twelve Data (الخطة المجانية) محدودة بـ8 طلبات/دقيقة بس لكل مفتاح -
    // بولينغ كل 5 ثواني (12 طلب/دقيقة) بيتخطاه لحاله حتى بدون أي طلب تاني.
    // فلما يكون المصدر الفعلي twelvedata منبطّئ لـ10 ثواني (6 طلبات/دقيقة)
    // تارِكين هامش لطلبات تانية (لوحة المقارنة، تبديل فريم/أصل...). باقي
    // الأصول (Yahoo) تضل على 5 ثواني العادية لأنه ما عندها حد صارم مشابه.
    const pollMs = dataSourceRef.current.provider === "twelvedata" ? 10000 : 5000;
    livePollRef.current = setInterval(pollLiveOnce, pollMs);
  }

  /* أعلى قيمة revealCount مسموح نوصلها بهاد الجلسة - إذا في منطقة قص مطبّقة
     (appliedCutRegion)، منوقف عندها بدل ما نكمل لآخر البيانات، بدون ما نحذف
     أي شمعة فعلياً من allCandles (الحد هون بس "أعلى سقف عرض" مؤقت). محسوبة
     من الوقت الحقيقي toTime مباشرة، فتضل صحيحة تلقائياً حتى لو تغيّر الفريم. */
  function cutRegionEndIndex() {
    const ap = appliedCutRegionRef.current;
    if (!ap || !allCandles.length) return allCandles.length;
    let idx = allCandles.findIndex((c) => c.time >= ap.toTime);
    if (idx === -1) idx = allCandles.length - 1;
    return idx + 1;
  }

  /* ===================== وضع تدريب (خطوة خطوة) ===================== */
  function handleNext() {
    const cap = cutRegionEndIndex();
    setRevealCount((c) => Math.min(c + 1, allCandles.length, cap));
  }
  function handleRandomStart() {
    loadData();
  }
  function handleReset() {
    // لو في منطقة قص مطبّقة، "إعادة من البداية" لازم ترجع لبداية المنطقة
    // نفسها (fromTime)، مش لسلوك CONTEXT_BARS الافتراضي القديم
    const ap = appliedCutRegionRef.current;
    if (ap && allCandles.length) {
      let idx = allCandles.findIndex((c) => c.time >= ap.fromTime);
      if (idx === -1) idx = 0;
      setRevealCount(idx + 1);
      setIsPlaying(false);
      return;
    }
    const maxStart = Math.max(CONTEXT_BARS, allCandles.length - 100);
    setRevealCount(Math.min(CONTEXT_BARS, maxStart));
    setIsPlaying(false);
  }
  function togglePlay() {
    setIsPlaying((p) => !p);
  }
  useEffect(() => {
    if (!isPlaying) { clearInterval(playTimerRef.current); return; }
    // السرعة مخزّنة كـ "شموع بالثانية" (1x..10x)، فمدة الفاصل الحقيقية = 1000 / السرعة
    const stepMs = Math.max(30, Math.round(1000 / (speed || 1)));
    playTimerRef.current = setInterval(() => {
      setRevealCount((c) => {
        const limit = Math.min(allCandles.length, cutRegionEndIndex());
        if (c >= limit) { setIsPlaying(false); return c; }
        return c + 1;
      });
    }, stepMs);
    return () => clearInterval(playTimerRef.current);
  }, [isPlaying, speed, allCandles.length]);

  function switchMode(m) {
    setMode(m);
  }

  /* ===================== أداة القص الجديدة: سحب لتحديد منطقة كاملة =====================
     3 أوضاع فرعية (cutSubMode) بتتحكم بمعنى السحب على الشارت وإحنا بوضع القص:
       - select: سحب من الصفر بيرسم منطقة جديدة (فوق أي منطقة قديمة قيد التعديل)
       - move: سحب من جوا المنطقة بيحرّكها كلها (نفس الاتساع، بس مكان مختلف)
       - edit-edges: سحب قريب من حافة يمين أو شمال بيمدد/يقصر تلك الحافة لحالها
     المنطقة بتترسم بإحداثيات logical (نسبة لمصفوفة الشموع الحالية) طول ما هي
     "قيد التعديل" بس، ولما تنطبق (تطبيق القص) منحوّلها فوراً لوقت حقيقي
     (fromTime/toTime) عشان تضل صحيحة تلقائياً عبر أي تغيير فريم/زوم/بان. */
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart || !cutMode) {
      cutHoverLogicalRef.current = null;
      cutDragRef.current = null;
      return;
    }
    function logicalFromClientX(clientX) {
      const rect = canvas.getBoundingClientRect();
      return chart.timeScale().coordinateToLogical(clientX - rect.left);
    }
    const EDGE_HIT_PX = 10;
    function edgeAtClientX(clientX) {
      const region = cutRegionRef.current;
      if (!region) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const fromX = chart.timeScale().logicalToCoordinate(region.fromLogical);
      const toX = chart.timeScale().logicalToCoordinate(region.toLogical);
      if (fromX != null && Math.abs(x - fromX) <= EDGE_HIT_PX) return "from";
      if (toX != null && Math.abs(x - toX) <= EDGE_HIT_PX) return "to";
      return null;
    }
    function insideRegion(clientX) {
      const region = cutRegionRef.current;
      if (!region) return false;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const fromX = chart.timeScale().logicalToCoordinate(region.fromLogical);
      const toX = chart.timeScale().logicalToCoordinate(region.toLogical);
      if (fromX == null || toX == null) return false;
      return x >= Math.min(fromX, toX) && x <= Math.max(fromX, toX);
    }
    function clampLogical(logical) {
      if (!allCandles.length) return logical;
      const v = Math.max(0, Math.min(allCandles.length - 1, logical));
      return cutPrecision === "pixel" ? Math.round(v) : v;
    }
    function onDown(e) {
      if (e.button !== 0) return;
      const logical = logicalFromClientX(e.clientX);
      if (logical == null) return;
      const sub = cutSubModeRef.current;
      const edge = sub === "edit-edges" ? edgeAtClientX(e.clientX) : null;
      if (edge) {
        cutDragRef.current = { mode: "edge", edge, region: { ...cutRegionRef.current } };
        return;
      }
      if (sub === "move" && insideRegion(e.clientX)) {
        cutDragRef.current = { mode: "move", startLogical: logical, region: { ...cutRegionRef.current } };
        return;
      }
      if (sub === "select") {
        // ما منعرض أي منطقة/حواف لسا - بس منسجّل نقطة البداية (بالإحداثيات
        // الحقيقية بالبكسل كمان، مش بس logical) عشان نميّز كليك حقيقي عن سحب
        // فعلي بدقة (شوفي onMove تحت). القص الفوري بيصير عند onUp لو ما في
        // سحب حقيقي تجاوز حد البكسل.
        cutDragRef.current = { mode: "select", startLogical: logical, startClientX: e.clientX, moved: false };
      }
    }
    function onMove(e) {
      const drag = cutDragRef.current;
      const logical = logicalFromClientX(e.clientX);
      if (!drag) {
        cutHoverLogicalRef.current = logical;
        scheduleDraw();
        return;
      }
      if (logical == null) return;
      if (drag.mode === "select") {
        // حد بكسل حقيقي (5px) قبل ما نعتبرها سحب فعلي - أي كليك عادي فيه
        // ارتجاف بسيط بالماوس/تراك باد، فما لازم يتحوّل لمنطقة سحب بالغلط
        // ويمنع القص الفوري (هاد بالضبط كان سبب ظهور الحواف مع كل كليك).
        if (!drag.moved && Math.abs(e.clientX - drag.startClientX) < 5) return;
        drag.moved = true;
        setCutRegion({ fromLogical: Math.min(drag.startLogical, logical), toLogical: Math.max(drag.startLogical, logical) });
      } else if (drag.mode === "move") {
        const delta = logical - drag.startLogical;
        const span = drag.region.toLogical - drag.region.fromLogical;
        const maxLogical = allCandles.length - 1;
        let from = drag.region.fromLogical + delta;
        let to = drag.region.toLogical + delta;
        if (from < 0) { from = 0; to = span; }
        if (to > maxLogical) { to = maxLogical; from = maxLogical - span; }
        setCutRegion({ fromLogical: from, toLogical: to });
      } else if (drag.mode === "edge") {
        const region = drag.region;
        if (drag.edge === "from") {
          setCutRegion({ fromLogical: Math.max(0, Math.min(logical, region.toLogical - 1)), toLogical: region.toLogical });
        } else {
          setCutRegion({ fromLogical: region.fromLogical, toLogical: Math.min(allCandles.length - 1, Math.max(logical, region.fromLogical + 1)) });
        }
      }
      scheduleDraw();
    }
    function onUp() {
      const drag = cutDragRef.current;
      if (drag && drag.mode === "select" && !drag.moved) {
        // كليك بسيط بدون سحب فعلي = قص فوري مباشر عند نفس الشمعة يلي كانت
        // ظاهرة بتلميح التاريخ فوق خط المعاينة (نفس صيغة التقريب بالضبط:
        // Math.round) - بدون منطقة/حواف وبدون حاجة لزر "تطبيق" منفصل.
        cutDragRef.current = null;
        commitCutAt(drag.startLogical);
        return;
      } else if (drag && cutRegionRef.current) {
        const r = cutRegionRef.current;
        setCutRegion({ fromLogical: clampLogical(r.fromLogical), toLogical: clampLogical(r.toLogical) });
      }
      cutDragRef.current = null;
    }
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      cutHoverLogicalRef.current = null;
      cutDragRef.current = null;
    };
  }, [cutMode, allCandles, cutPrecision]);

  function cutIndexForLogical(logical) {
    if (!allCandles.length) return 0;
    return Math.max(0, Math.min(allCandles.length - 1, Math.round(logical)));
  }
  /* تطبيق القص: منحوّل المنطقة (logical) لوقت حقيقي ومنثبّتها - بدون ما نحذف
     ولا شمعة وحدة من allCandles، بس منعيّن من وين يبلّش الاستعراض (fromTime)
     ومتى ما بعد نكمل نكشف شموع جديدة تلقائياً/يدوياً (toTime، شوفي
     cutRegionEndIndex فوق) - بالضبط "قص بدون حذف بيانات". */
  /* الجزء المشترك بين "تطبيق منطقة مسحوبة" و"قص فوري بكليك واحد" تحت -
     منحوّل شمعة البداية/النهاية لوقت حقيقي ومنثبّتها (بدون حذف ولا شمعة من
     allCandles، بس منعيّن من وين يبلّش الاستعراض). */
  function finalizeCut(fromCandle, toCandle, fromIdx) {
    stopLivePoll();
    setMode("training");
    setIsPlaying(false);
    replayStateRef.current = { isActive: true, anchorTimestamp: fromCandle.time, currentTimestamp: fromCandle.time, originalTimeframe: intervalRef.current };
    setRevealCount(fromIdx + 1);
    setAppliedCutRegion({ fromTime: fromCandle.time, toTime: toCandle.time });
    if (cutAutoSave) {
      try {
        localStorage.setItem(
          `qta_cut_region_${assetValue}_${interval}`,
          JSON.stringify({ fromTime: fromCandle.time, toTime: toCandle.time })
        );
      } catch {}
    }
    setCutMode(false);
    setCutRegion(null);
  }
  /* قص فوري بكليك واحد (بدون سحب منطقة ولا حواف ولا زر "تطبيق" منفصل) -
     الشمعة المُختارة هي بالضبط نفسها يلي كانت ظاهرة بتلميح التاريخ فوق خط
     المعاينة (نفس Math.round)، فالتاريخ يلي بتشوفيه هو نفسه يلي رح ينقص عليه. */
  function commitCutAt(logical) {
    if (!allCandles.length) { setCutMode(false); return; }
    const idx = cutIndexForLogical(logical);
    const candle = allCandles[idx];
    if (!candle) { setCutMode(false); return; }
    finalizeCut(candle, candle, idx);
  }
  function applyCutRegion() {
    const region = cutRegionRef.current;
    if (!region || !allCandles.length) { setCutMode(false); return; }
    const fromIdx = cutIndexForLogical(region.fromLogical);
    const toIdx = cutIndexForLogical(region.toLogical);
    const fromCandle = allCandles[fromIdx];
    const toCandle = allCandles[toIdx] || fromCandle;
    if (!fromCandle) { setCutMode(false); return; }
    finalizeCut(fromCandle, toCandle, fromIdx);
  }

  /* إلغاء القص: يسكّر وضع التعديل ويرمي المنطقة "قيد التعديل" (غير المطبّقة) -
     أي منطقة مطبّقة سابقاً (appliedCutRegion) بتضل شغالة متل ما هي */
  function cancelCutMode() {
    setCutMode(false);
    setCutRegion(null);
    cutDragRef.current = null;
  }
  /* إعادة ضبط القص: بترمي بس المنطقة "قيد التعديل" الحالية وترجع لوضع "سحب
     لتحديد منطقة" من الصفر، بدون ما تسكّر وضع القص نفسه */
  function resetCutRegion() {
    setCutRegion(null);
    setCutSubMode("select");
  }
  function toggleCutMode() {
    setCutMode((c) => {
      const next = !c;
      if (next) {
        setCutSubMode("select");
        // "حفظ القص تلقائياً" مفعّل: نحاول نجيب آخر منطقة قص محفوظة لنفس
        // الأصل/الفريم ونعبّي فيها الاختيار تلقائياً بدل ما تبلّشي من الصفر
        if (cutAutoSave) {
          try {
            const raw = localStorage.getItem(`qta_cut_region_${assetValue}_${interval}`);
            const saved = raw ? JSON.parse(raw) : null;
            if (saved && Number.isFinite(saved.fromTime) && Number.isFinite(saved.toTime) && allCandles.length) {
              const fromIdx = allCandles.findIndex((c2) => c2.time >= saved.fromTime);
              const toIdx = allCandles.findIndex((c2) => c2.time >= saved.toTime);
              setCutRegion(
                fromIdx !== -1
                  ? { fromLogical: fromIdx, toLogical: toIdx !== -1 ? toIdx : allCandles.length - 1 }
                  : null
              );
            } else setCutRegion(null);
          } catch { setCutRegion(null); }
        } else {
          setCutRegion(null);
        }
      }
      return next;
    });
  }

  /* ===================== قص/تصدير الشارت كصورة ===================== */
  function handleExportImage() {
    if (!chartRef.current) return;
    try {
      const canvas = chartRef.current.takeScreenshot();
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `qta-chart-${assetValue}-${interval}-${Date.now()}.png`;
      a.click();
    } catch (e) {
      alert("تعذّر تصدير الصورة، حاولي مرة تانية");
    }
  }

  const finished = mode === "training" && allCandles.length > 0 && revealCount >= allCandles.length;

  /* شريط علوي واحد مضغوط (ستايل تريدنغ فيو): كل شي بصف واحد - الأصل/الفريم/السرعة
     يمين، وأزرار الإجراءات (عشوائي/قص/مقارنة/تصدير/إعادة تعيين/شاشة كاملة/إعدادات)
     شمال، بدون صناديق كبيرة فوق بعض زي قبل. */
  function renderTopBar() {
    const iconBtn = (active, disabled) => ({
      width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", border: "1px solid transparent",
      background: active ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
      color: active ? "#1a1608" : disabled ? "#4a4e58" : "#c7cad1",
      opacity: disabled ? 0.5 : 1, flexShrink: 0,
    });
    return (
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center",
        marginBottom: "0.6rem", background: "#131722",
        border: "1px solid #242832", borderRadius: 10, padding: "0.35rem 0.5rem",
        // مهم: الصفحة كلها dir="rtl"، وبدون تثبيت الاتجاه هون كان "row" الافتراضي
        // بينقلب تلقائياً (أول عنصر بالـDOM بيطلع أقصى اليمين مش الشمال)، فكانت
        // كل أزرار الأدوات تطلع بعكس المكان المطلوب (يمين بدل شمال) وصندوق
        // الحالة/الفريم/الأصل يطلع شمال بدل يمين. تثبيت ltr هون بيخلي ترتيب
        // العناصر بالـDOM يطابق ترتيبها البصري دايماً: الأزرار شمال، والحالة/
        // الفريم/الأصل يمين - بغض النظر عن اتجاه باقي الصفحة.
        direction: "ltr",
      }}>
        {/* مجموعة أزرار الأدوات (أيقونات فقط، بدون نص) */}
        <button onClick={() => setSettingsOpen(true)} style={iconBtn(false)} title="إعدادات الشارت"><ToolIcon id="gear" /></button>
        <button onClick={handleUndoLastDrawing} style={iconBtn(false)} title="تراجع عن آخر رسمة"><ToolIcon id="undo" /></button>
        {mode === "training" ? (
          <button onClick={handleReset} style={iconBtn(false)} title="إعادة من البداية"><ToolIcon id="refresh" /></button>
        ) : (
          <button onClick={() => loadData()} style={iconBtn(false)} title="تحديث"><ToolIcon id="refresh" /></button>
        )}
        <div style={{ width: 1, height: 22, background: "#242832" }} />
        <button onClick={toggleCompare} style={iconBtn(compareOpen)} title="اعرضي رمز ثاني بلوحة منفصلة أسفل الشارت للمقارنة"><ToolIcon id="compare2" /></button>
        <button
          onClick={() => setIndicatorPanelOpen((v) => !v)}
          style={{ ...iconBtn(indicatorPanelOpen), position: "relative" }}
          title="المؤشرات الفنية"
        >
          <ToolIcon id="indicators2" />
          {activeIndicators.length > 0 && (
            <span style={{
              position: "absolute", top: 1, right: 1, minWidth: 13, height: 13, borderRadius: 7,
              background: GOLD, color: "#1a1608", fontSize: 9, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px",
            }}>{activeIndicators.length}</span>
          )}
        </button>
        <button onClick={() => setTemplatesPanelOpen((v) => !v)} style={iconBtn(templatesPanelOpen)} title="قوالب: احفظي أو حمّلي مجموعة مؤشرات/إعدادات جاهزة"><ToolIcon id="template2" /></button>
        <button onClick={handleExportImage} style={iconBtn(false)} title="تصدير كصورة"><ToolIcon id="camera" /></button>
        <button onClick={handleResetView} style={iconBtn(false)} title="إعادة الزوم والسكرول لوضعهم الطبيعي"><ToolIcon id="resetzoom" /></button>
        <button onClick={toggleFullscreen} style={iconBtn(isFullscreen)} title="شاشة كاملة"><ToolIcon id={isFullscreen ? "fullscreenExit" : "fullscreen"} /></button>
        <div style={{ width: 1, height: 22, background: "#242832" }} />
        <button onClick={() => setRandomChart((r) => !r)} style={iconBtn(randomChart)} title="حركة سعر مولّدة عشوائياً بدل السوق الحقيقي"><ToolIcon id="dice2" /></button>
        <button
          onClick={toggleCutMode}
          style={iconBtn(cutMode, !supported || allCandles.length === 0)}
          title="فعّلي القص، بعدين اسحبي عالشارت لتحديد منطقة بداية الاستعراض"
          disabled={!supported || allCandles.length === 0}
        >
          <ToolIcon id="scissors2" />
        </button>
        {cutMode && (
          <>
            <button onClick={() => setCutSubMode("select")} style={iconBtn(cutSubMode === "select")} title="سحب لتحديد المنطقة">
              <ToolIcon id="marquee" />
            </button>
            <button onClick={() => setCutSubMode("move")} style={iconBtn(cutSubMode === "move", !cutRegion)} disabled={!cutRegion} title="تحريك المنطقة">
              <ToolIcon id="dragDots" />
            </button>
            <button onClick={() => setCutSubMode("edit-edges")} style={iconBtn(cutSubMode === "edit-edges", !cutRegion)} disabled={!cutRegion} title="تعديل الحواف">
              <ToolIcon id="pencilLine" />
            </button>
            <button onClick={resetCutRegion} style={iconBtn(false, !cutRegion)} disabled={!cutRegion} title="إعادة ضبط القص">
              <ToolIcon id="refresh" />
            </button>
            <button
              onClick={() => setCutSettingsOpen((v) => !v)}
              style={{ ...iconBtn(cutSettingsOpen), position: "relative" }}
              title="إعدادات القص"
            >
              <ToolIcon id="gear" />
              {cutSettingsOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute", top: 38, insetInlineStart: 0, zIndex: 30,
                    background: "#131722", border: "1px solid #242832", borderRadius: 10,
                    padding: "0.6rem 0.75rem", minWidth: 210, boxShadow: "0 10px 28px rgba(0,0,0,0.5)",
                    display: "flex", flexDirection: "column", gap: 8, direction: "rtl", cursor: "default",
                  }}
                >
                  {[
                    ["إظهار منطقة القص", cutShowRegion, setCutShowRegion],
                    ["تعتيم خارج المنطقة", cutDimOutside, setCutDimOutside],
                    ["حفظ القص تلقائياً", cutAutoSave, setCutAutoSave],
                  ].map(([label, val, setter]) => (
                    <label key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#c7cad1", cursor: "pointer" }}>
                      <span>{label}</span>
                      <span
                        onClick={() => setter((v) => !v)}
                        style={{
                          width: 32, height: 18, borderRadius: 9, position: "relative", flexShrink: 0,
                          background: val ? GOLD : "#2a2e38", transition: "background 0.15s",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 2, insetInlineStart: val ? 16 : 2, width: 14, height: 14,
                          borderRadius: 7, background: val ? "#1a1608" : "#8b8f99", transition: "inset-inline-start 0.15s",
                        }} />
                      </span>
                    </label>
                  ))}
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#c7cad1" }}>
                    <span>دقة القص</span>
                    <select
                      value={cutPrecision}
                      onChange={(e) => setCutPrecision(e.target.value)}
                      style={{ background: "#1a1e28", color: "#EAECEF", border: "1px solid #2a2e38", borderRadius: 6, fontSize: 11, padding: "2px 6px" }}
                    >
                      <option value="pixel">Pixel Perfect</option>
                      <option value="free">حرة (Free)</option>
                    </select>
                  </label>
                </div>
              )}
            </button>
            <button onClick={applyCutRegion} disabled={!cutRegion} style={iconBtn(false, !cutRegion)} title="تطبيق القص">
              <ToolIcon id="checkmark" />
            </button>
            <button onClick={cancelCutMode} style={iconBtn(false)} title="إلغاء القص">
              <ToolIcon id="xmark" />
            </button>
          </>
        )}
        {mode === "training" && (
          <>
            <div style={{ width: 1, height: 22, background: "#242832" }} />
            <button onClick={handleRandomStart} style={iconBtn(false)} title="بداية عشوائية جديدة">🎲</button>
            <button onClick={togglePlay} disabled={finished || loading} style={iconBtn(isPlaying)} title={isPlaying ? "إيقاف" : "تشغيل تلقائي"}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button onClick={handleNext} disabled={finished || loading} style={iconBtn(false)} title="الشمعة التالية">⏭</button>
            <button onClick={() => switchMode("live")} style={iconBtn(false)} title="ارجعي للمتابعة المباشرة للسوق">🔴</button>
          </>
        )}

        <div style={{ flex: 1 }} />

        {isAdmin && (
          <button
            onClick={() => { setDrawingsListTick((t) => t + 1); setPracticePanelOpen(true); }}
            style={{ ...iconBtn(false), width: "auto", padding: "0 10px", fontSize: 12, fontWeight: 700 }}
            title="تسجيل تمرين تفاعلي جديد (SMC + ICT)"
          >
            🎯 تسجيل تمرين
          </button>
        )}

        {/* مجموعة اليمين: حالة السوق + الفريم/السرعة + الأصل */}
        <span style={{
          display: "flex", alignItems: "center", gap: 6, padding: "0.3rem 0.7rem",
          borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "default",
          border: `1px solid ${mode === "live" ? GREEN : GOLD}55`,
          color: mode === "live" ? GREEN : GOLD_LIGHT,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: mode === "live" ? GREEN : GOLD }} />
          {mode === "live" ? "مباشر" : "تاريخي"}
        </span>

        {mode === "training" && (
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="السرعة"
            style={{ ...selectStyle, minWidth: 70, padding: "0.35rem 0.5rem", fontSize: 12.5 }}>
            {SPEEDS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        )}

        <select value={interval} onChange={(e) => setIntervalValue(e.target.value)} title="الفريم"
          style={{ ...selectStyle, minWidth: 70, padding: "0.35rem 0.5rem", fontSize: 12.5 }}>
          {INTERVALS.map((o) => {
            // لو في نقطة قص Replay فعّالة، منحسب عمرها بالأيام ومنعطّل أي فريم
            // عمق بياناته الحقيقي (rangeDays) أقصر من هيك عمر — بدل ما نخلّي
            // المستخدم يبدّل وبعدين يوصله توست "أقرب نقطة متاحة". لو الأصل
            // الحالي عنده رمز Dukascopy، منستخدم عمق موسّع (rangeDaysFor) بدل
            // حد يوهو الضيق، لأنه أداة الريبلاي رح تجرب Dukascopy أول شي.
            const cutAgeDays = replayStateRef.current.isActive && replayCutTs
              ? (Date.now() / 1000 - replayCutTs) / 86400
              : null;
            const hasDuk = !!getAssetByValue(assetValue)?.dukascopy;
            const unreachable = cutAgeDays != null && cutAgeDays > rangeDaysFor(o.value, hasDuk);
            return (
              <option
                key={o.value}
                value={o.value}
                disabled={unreachable}
                title={unreachable ? "نقطة القص أبعد من عمق البيانات المتاح لهاد الفريم" : undefined}
              >
                {o.label}{unreachable ? " (بعيد عن نقطة القص)" : ""}
              </option>
            );
          })}
        </select>

        <select
          value={assetValue}
          onChange={(e) => setAssetValue(e.target.value)}
          disabled={randomChart}
          title="الأصل"
          style={{ ...selectStyle, minWidth: 130, padding: "0.35rem 0.5rem", fontSize: 12.5 }}
        >
          {ASSETS.map((g) => (
            <optgroup key={g.group} label={g.group} style={{ background: "#181A20", color: GOLD_LIGHT }}>
              {g.items.map((it) => (
                <option
                  key={it.v}
                  value={it.v}
                  disabled={!it.yahoo}
                  style={{ background: "#181A20", color: it.yahoo ? "#f0f0f0" : "#777" }}
                >
                  {it.label}{!it.yahoo ? " (غير مدعوم بعد)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  }

  /* شريط أدوات الرسم العمودي (ستايل تريدنغ فيو) — عمود جانبي ثابت بجانب الشارت
     (مش طايف فوقه)، عالشمال دايماً بغض النظر عن اتجاه الصفحة، ومقسّم لأقسام.
     كل زر فيه أيقونة + تسمية نصية تحتها (زي الستايل المطلوب). كل مجموعة فيها
     أكتر من أداة بتظهر كأيقونة وحدة + سهم صغير: ضغطة عالسهم بتفتح قائمة جانبية
     بأسماء كل الأدوات واضحة زي تريدنغ فيو تماماً. */
  /* شريط أفقي عائم فوق الشارت بيعرض بس الأدوات يلي المستخدم فضّلها (بالنجمة
     ⭐ جوا القوائم المنسدلة)، ضغطة وحدة عالأيقونة بتفعّل الأداة مباشرة - بديل
     سريع بدل ما تفوتي عالقائمة الكاملة كل مرة */
  function renderFavoritesBar() {
    if (!favoriteTools.length) return null;
    return (
      <div style={{
        position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: 9,
        display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", maxWidth: "80%",
        background: "#131722ee", border: "1px solid #242832", borderRadius: 10,
        padding: 4, boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      }}>
        {favoriteTools.map((id) => (
          <button
            key={id}
            type="button"
            title={TOOL_TITLES[id] || id}
            onClick={(e) => { e.stopPropagation(); setActiveTool((cur) => (cur === id ? "cursor" : id)); }}
            style={{
              width: 34, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 7, border: "1px solid transparent", cursor: "pointer",
              background: activeTool === id ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
              color: activeTool === id ? "#1a1608" : "#c9ccd3",
            }}
          >
            <ToolIcon id={id} />
          </button>
        ))}
      </div>
    );
  }

  function renderDrawToolbar() {
    function openFlyout(gi, btnEl) {
      groupBtnRefs.current[gi] = btnEl;
      setOpenToolGroup((cur) => (cur === gi ? null : gi));
    }
    function pickTool(gi, id) {
      setActiveTool(id);
      setToolGroupDefault((prev) => ({ ...prev, [gi]: id }));
      setOpenToolGroup(null);
    }
    function sidebarBtnStyle(active) {
      return {
        width: 62, minHeight: 52, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 3, borderRadius: 8, cursor: "pointer",
        border: "1px solid transparent",
        background: active ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
        color: active ? "#1a1608" : "#9aa0aa",
        transition: "background .12s, color .12s", flexShrink: 0, padding: "6px 2px",
      };
    }
    const labelStyle = (active) => ({ fontSize: 10, fontWeight: 600, color: active ? "#1a1608" : "#8a8f99", lineHeight: 1.1 });
    return (
      <div style={{
        flex: "0 0 auto", alignSelf: "stretch", position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column", gap: 3,
        background: "#131722", border: "1px solid #242832", borderRadius: 10, padding: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        height: "100%", overflowY: "auto", overflowX: "visible",
      }}>
        {TOOL_GROUPS.map((group, gi) => {
          const hasMultiple = group.length > 1;
          const currentId = hasMultiple ? (toolGroupDefault[gi] || group[0]) : group[0];
          const isActive = group.includes(activeTool);
          return (
            <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {gi > 0 && <div style={{ height: 1, background: "#242832", margin: "3px 4px" }} />}
              <button
                type="button"
                title={TOOL_TITLES[currentId]}
                onClick={(e) => { e.stopPropagation(); setActiveTool((cur) => (cur === currentId ? "cursor" : currentId)); }}
                style={{ ...sidebarBtnStyle(isActive), position: "relative" }}
              >
                <ToolIcon id={currentId} />
                <span style={labelStyle(isActive)}>{GROUP_LABELS[gi]}</span>
                {hasMultiple && (
                  // منطقة ضغط أكبر بكتير من المثلث نفسه (كانت قبل شبه بلا مساحة،
                  // فصعب جداً تصيبيها بالماوس/بالإصبع). هلأ صار في مربع ٢٦×٢٤ كامل
                  // قابل للضغط بزاوية الزر، والمثلث المرسوم جواه بس أكبر شوي عشان يبان أوضح.
                  <span
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openFlyout(gi, e.currentTarget.parentElement); }}
                    style={{
                      position: "absolute", bottom: 0, right: 0, width: 26, height: 24,
                      display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
                      padding: "0 4px 4px 0", cursor: "pointer",
                    }}
                  >
                    <span style={{
                      width: 0, height: 0,
                      borderLeft: "5px solid transparent", borderBottom: "5px solid #8a8a8a",
                    }} />
                  </span>
                )}
              </button>
              {hasMultiple && openToolGroup === gi && (() => {
                const btnRect = groupBtnRefs.current[gi]?.getBoundingClientRect();
                return (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "fixed", zIndex: 25,
                    top: btnRect ? btnRect.top : 0,
                    left: btnRect ? btnRect.right + 8 : 0,
                    background: "#171b26", border: "1px solid #242832", borderRadius: 10,
                    boxShadow: "0 8px 28px rgba(0,0,0,0.55)", minWidth: 230,
                    maxHeight: 420, overflowY: "auto", padding: "6px 0",
                  }}
                >
                  {(TOOL_GROUP_SECTIONS[gi] || [{ title: null, tools: group }]).map((section, si) => (
                    <div key={si}>
                      {section.title && (
                        <div style={{
                          padding: "6px 14px 4px", fontSize: 10.5, fontWeight: 700,
                          color: "#777", letterSpacing: 0.5,
                        }}>
                          {section.title}
                        </div>
                      )}
                      {section.tools.map((id) => {
                        const isFav = favoriteTools.includes(id);
                        return (
                          <div
                            key={id}
                            onClick={() => pickTool(gi, id)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              gap: 10, padding: "8px 14px", cursor: "pointer", fontSize: 13,
                              color: activeTool === id ? GOLD_LIGHT : "#e5e5e5",
                              background: activeTool === id ? "#20242f" : "transparent",
                            }}
                            onMouseEnter={(e) => { if (activeTool !== id) e.currentTarget.style.background = "#1c202a"; }}
                            onMouseLeave={(e) => { if (activeTool !== id) e.currentTarget.style.background = "transparent"; }}
                          >
                            <span style={{ flex: 1 }}>{TOOL_TITLES[id]}</span>
                            <span
                              title={isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                              onClick={(e) => { e.stopPropagation(); toggleFavoriteTool(id); }}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: 20, height: 20, flexShrink: 0, cursor: "pointer", fontSize: 14,
                                color: isFav ? GOLD_LIGHT : "#4a4e58",
                              }}
                            >
                              {isFav ? "★" : "☆"}
                            </span>
                            <span style={{ display: "flex", color: "#aaa", flexShrink: 0 }}><ToolIcon id={id} /></span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                );
              })()}
            </div>
          );
        })}
        <div style={{ height: 1, background: "#242832", margin: "3px 4px" }} />
        <button
          type="button"
          title={`مغناطيس: ${magnetOn ? "مفعّل" : "معطّل"} — يشتغل فقط أثناء استخدام أداة رسم، ويلتصق بأقرب سعر لما تقربي منه فعلاً`}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMagnetOn((m) => !m); }}
          style={{ ...sidebarBtnStyle(magnetOn), position: "relative" }}
        >
          <ToolIcon id="magnet" />
          <span style={labelStyle(magnetOn)}>مغناطيس</span>
          <span style={{
            position: "absolute", top: 5, right: 8, width: 6, height: 6, borderRadius: "50%",
            background: magnetOn ? GREEN : "#555", border: "1px solid #131722",
          }} />
        </button>
        <button type="button" title={drawingsVisible ? "إخفاء الرسومات" : "إظهار الرسومات"} onClick={(e) => { e.stopPropagation(); toggleDrawingsVisible(); }} style={sidebarBtnStyle(!drawingsVisible)}>
          <ToolIcon id={drawingsVisible ? "eye" : "eyeOff"} />
          <span style={labelStyle(!drawingsVisible)}>{drawingsVisible ? "إظهار" : "مخفي"}</span>
        </button>
        <button
          type="button"
          title={allDrawingsLocked ? "فك قفل كل الرسومات" : "قفل كل الرسومات (منع التحريك/التعديل)"}
          onClick={(e) => { e.stopPropagation(); toggleLockAllDrawings(); }}
          style={sidebarBtnStyle(allDrawingsLocked)}
        >
          <ToolIcon id={allDrawingsLocked ? "lock" : "unlock"} />
          <span style={labelStyle(allDrawingsLocked)}>قفل</span>
        </button>
        <button type="button" title="قوالب: احفظي أو حمّلي مجموعة مؤشرات جاهزة" onClick={(e) => { e.stopPropagation(); setTemplatesPanelOpen((v) => !v); }} style={sidebarBtnStyle(templatesPanelOpen)}>
          <ToolIcon id="template2" />
          <span style={labelStyle(templatesPanelOpen)}>قالب</span>
        </button>
        <button type="button" title="حذف كل الرسومات" onClick={(e) => { e.stopPropagation(); handleClearDrawings(); }} style={sidebarBtnStyle(false)}>
          <ToolIcon id="trash" />
          <span style={labelStyle(false)}>حذف</span>
        </button>
      </div>
    );
  }

  /* لوحة خصائص الرسمة المحددة (تظهر بضغطة دبل-كليك على أي رسمة بوضع المؤشر) */
  function renderPropertiesDialog() {
    if (!editDraft) return null;
    const type = editDraft.type;
    const style = editDraft.style || {};
    const updateStyle = (patch) => setEditDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
    const titleMap = {
      trendline: "خط اتجاه", ray: "شعاع", extendedline: "خط ممتد", infoline: "خط معلومات", angle: "زاوية الاتجاه",
      hline: "خط أفقي", hray: "شعاع أفقي", vline: "خط عمودي", crossline: "خط متقاطع", parallelchannel: "قناة متوازية",
      path: "مسار", rectangle: "مستطيل", circle: "دائرة",
      fib: "فيبوناتشي (تصحيح)", fibext: "فيبوناتشي (امتداد)", fibchannel: "قناة فيبوناتشي",
      fibtimezone: "مناطق فيبوناتشي الزمنية", gannfan: "مروحة غان", pitchfork: "شوكة أندروز",
      wave: "موجة تصحيح (0،A،B،C)",
      pricerange: "نطاق السعر", daterange: "نطاق التاريخ", position_long: "مركز شراء", position_short: "مركز بيع",
      text: "نص",
    };
    const row = (label, control) => (
      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #262626" }}>
        <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
        {control}
      </div>
    );
    const colorInput = (val, onChange) => (
      <input type="color" value={val || GOLD_LIGHT} onChange={(e) => onChange(e.target.value)}
        style={{ width: 34, height: 26, border: "1px solid #333", borderRadius: 6, background: "none", cursor: "pointer", padding: 0 }} />
    );
    const widthSelect = (val, onChange) => (
      <select value={val || 1.5} onChange={(e) => onChange(Number(e.target.value))} style={selectStyle}>
        {[1, 1.5, 2, 3, 4].map((w) => (<option key={w} value={w}>{w}</option>))}
      </select>
    );
    const checkbox = (val, onChange) => (
      <input type="checkbox" checked={!!val} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
    );
    const priceInput = (val, onChange) => (
      <input
        type="number" step="0.00001" value={val ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ...selectStyle, width: 120 }}
      />
    );
    const dashSelect = (val, onChange) => (
      <select value={val || "solid"} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="solid">متصل</option>
        <option value="dashed">متقطع</option>
        <option value="dotted">منقّط</option>
      </select>
    );
    const extendSelect = (val, onChange) => (
      <select value={val || "none"} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        <option value="none">بدون تمديد</option>
        <option value="right">تمديد لليمين</option>
        <option value="left">تمديد لليسار</option>
        <option value="both">تمديد الجهتين</option>
      </select>
    );
    /* محرر مستويات فيبوناتشي — نفس فكرة لوحة تريدنغ فيو: تفعيل/تعطيل + قيمة + لون لكل مستوى */
    const levelsEditor = () => {
      const levels = style.levels || [];
      const updateLevel = (idx, patch) => {
        const next = levels.map((l, i) => (i === idx ? { ...l, ...patch } : l));
        updateStyle({ levels: next });
      };
      return (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, color: "#999", padding: "6px 0 4px" }}>المستويات (فعّلي/عطّلي، غيّري القيمة واللون لكل واحد)</div>
          {levels.map((lvl, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
              {checkbox(lvl.enabled, (v) => updateLevel(i, { enabled: v }))}
              {colorInput(lvl.color, (v) => updateLevel(i, { color: v }))}
              <input
                type="number" step="0.001" value={lvl.value}
                onChange={(e) => updateLevel(i, { value: Number(e.target.value) })}
                style={{ ...selectStyle, width: 80, flex: 1 }}
              />
              <button
                onClick={() => updateStyle({ levels: levels.filter((_, j) => j !== i) })}
                style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13 }}
                title="حذف هذا المستوى"
              >✕</button>
            </div>
          ))}
          <button
            onClick={() => updateStyle({ levels: [...levels, { value: 0, color: GOLD_LIGHT, enabled: true }] })}
            style={{ ...btnStyle("secondary"), width: "100%", marginTop: 6, padding: "0.4rem", fontSize: 12.5 }}
          >+ إضافة مستوى</button>
        </div>
      );
    };

    return (
      <div style={{
        position: "absolute", top: 10, left: 68, zIndex: 20, width: 300,
        background: "#2B2F36", border: "1px solid #333", borderRadius: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)", padding: 14, color: "#eee",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16 }}>✕</button>
          <div style={{ fontWeight: 700, fontSize: 14 }}>✏️ {titleMap[type] || type}</div>
        </div>
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {(type === "trendline" || type === "ray") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {type === "trendline" && row("التمديد", extendSelect(style.extend, (v) => updateStyle({ extend: v })))}
            </>
          )}
          {type === "extendedline" && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
            </>
          )}
          {(type === "infoline" || type === "angle") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
            </>
          )}
          {(type === "hline" || type === "hray" || type === "vline" || type === "crossline") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {row("النمط", dashSelect(style.dash, (v) => updateStyle({ dash: v })))}
            </>
          )}
          {type === "parallelchannel" && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {row("تعبئة الخلفية", checkbox(style.fill, (v) => updateStyle({ fill: v })))}
              {style.fill && row("لون الخلفية", colorInput(style.fillColor, (v) => updateStyle({ fillColor: v })))}
            </>
          )}
          {(type === "fibtimezone" || type === "gannfan" || type === "pitchfork") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {type === "fibtimezone" && row("النمط", dashSelect(style.dash, (v) => updateStyle({ dash: v })))}
            </>
          )}
          {(type === "rectangle" || type === "circle" || type === "path" || type === "triangle") && (
            <>
              {row("لون الإطار", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {type === "path" && row("إغلاق الشكل", checkbox(style.closed, (v) => updateStyle({ closed: v })))}
              {row("تعبئة الخلفية", checkbox(style.fill, (v) => updateStyle({ fill: v })))}
              {style.fill && row("لون الخلفية", colorInput(style.fillColor, (v) => updateStyle({ fillColor: v })))}
              {type === "rectangle" && row("خط المنتصف (50%)", checkbox(style.midline, (v) => updateStyle({ midline: v })))}
              {type === "rectangle" && style.midline && row("لون خط 50%", colorInput(style.midlineColor, (v) => updateStyle({ midlineColor: v })))}
              {type === "rectangle" && style.midline && row("خط متقطع", checkbox(style.midlineDash !== false, (v) => updateStyle({ midlineDash: v })))}
              {type === "rectangle" && (
                <>
                  <div style={{ fontSize: 12, color: "#999", padding: "10px 0 4px" }}>النص داخل المستطيل</div>
                  <textarea
                    value={editDraft.text || ""}
                    onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
                    placeholder="إضافة نص..."
                    rows={3}
                    style={{
                      width: "100%", background: "#1c1f27", border: "1px solid #333", borderRadius: 8,
                      color: "#eee", padding: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box",
                    }}
                  />
                  {row("حجم الخط", (
                    <select value={style.textSize || 13} onChange={(e) => updateStyle({ textSize: Number(e.target.value) })} style={selectStyle}>
                      {[10, 12, 13, 15, 18, 22].map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  ))}
                  {row("لون النص", colorInput(style.textColor, (v) => updateStyle({ textColor: v })))}
                  {row("عريض", checkbox(style.textBold, (v) => updateStyle({ textBold: v })))}
                  {row("مائل", checkbox(style.textItalic, (v) => updateStyle({ textItalic: v })))}
                  {row("محاذاة أفقية", (
                    <select value={style.textHAlign || "center"} onChange={(e) => updateStyle({ textHAlign: e.target.value })} style={selectStyle}>
                      <option value="left">يسار</option>
                      <option value="center">وسط</option>
                      <option value="right">يمين</option>
                    </select>
                  ))}
                  {row("محاذاة عمودية", (
                    <select value={style.textVAlign || "middle"} onChange={(e) => updateStyle({ textVAlign: e.target.value })} style={selectStyle}>
                      <option value="top">أعلى</option>
                      <option value="middle">بالداخل (وسط)</option>
                      <option value="bottom">أسفل</option>
                    </select>
                  ))}
                </>
              )}
            </>
          )}
          {(type === "pricerange" || type === "daterange") && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("تعبئة الخلفية", checkbox(style.fill, (v) => updateStyle({ fill: v })))}
              {style.fill && row("لون الخلفية", colorInput(style.fillColor, (v) => updateStyle({ fillColor: v })))}
            </>
          )}
          {(type === "position_long" || type === "position_short") && (() => {
            const levels = getPositionLevels(editDraft);
            return (
              <>
                {row("سعر الدخول", priceInput(editDraft.p1?.price, (v) => setEditDraft((d) => ({ ...d, p1: { ...d.p1, price: v } }))))}
                {row("سعر الهدف", priceInput(levels.targetPrice, (v) => setEditDraft((d) => ({ ...d, targetPrice: v }))))}
                {row("سعر وقف الخسارة", priceInput(levels.stopPrice, (v) => setEditDraft((d) => ({ ...d, stopPrice: v }))))}
                {row("لون الهدف", colorInput(style.targetColor, (v) => updateStyle({ targetColor: v })))}
                {row("لون وقف الخسارة", colorInput(style.stopColor, (v) => updateStyle({ stopColor: v })))}
              </>
            );
          })()}
          {(type === "fib" || type === "fibchannel") && (
            <>
              {row("لون افتراضي", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {type === "fib" && row("التمديد", extendSelect(style.extend, (v) => updateStyle({ extend: v })))}
              {levelsEditor()}
            </>
          )}
          {type === "fibext" && (
            <>
              {row("لون افتراضي", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("السماكة", widthSelect(style.width, (v) => updateStyle({ width: v })))}
              {row("تمديد الخطوط يميناً", (
                <select value={style.extend || "right"} onChange={(e) => updateStyle({ extend: e.target.value })} style={selectStyle}>
                  <option value="right">تمديد لليمين</option>
                  <option value="none">بدون تمديد</option>
                </select>
              ))}
              {levelsEditor()}
            </>
          )}
          {type === "wave" && (
            <>{row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}</>
          )}
          {type === "text" && (
            <>
              {row("اللون", colorInput(style.color, (v) => updateStyle({ color: v })))}
              {row("حجم الخط", (
                <select value={style.size || 13} onChange={(e) => updateStyle({ size: Number(e.target.value) })} style={selectStyle}>
                  {[10, 12, 13, 15, 18, 22].map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              ))}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={saveProperties} style={{ ...btnStyle("primary"), flex: 1, padding: "0.5rem" }}>موافق</button>
          <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ ...btnStyle("secondary"), flex: 1, padding: "0.5rem" }}>إلغاء</button>
        </div>
        <button onClick={deleteEditingDrawing} style={{ marginTop: 8, width: "100%", background: "none", border: "1px solid #7a2b2b", color: RED, borderRadius: 8, padding: "0.4rem", cursor: "pointer", fontSize: 12.5 }}>
          🗑 حذف هذه الرسمة
        </button>
      </div>
    );
  }

  /* شريط أدوات سريع وعائم يطلع فوق أي رسمة بمجرد ما تنكبس عليها كبسة وحدة (زي تريدنغ فيو):
     لون، سماكة، قفل، نسخ، حذف، وزر "..." لفتح لوحة الخصائص الكاملة لو احتجتي إعدادات أكتر */
  function renderSelectionToolbar() {
    const d = selectedDrawingId != null ? drawingsRef.current.find((dr) => dr.id === selectedDrawingId) : null;
    if (!d || d.tradeTag) return null;
    const style = d.style || {};
    const hasWidth = style.width !== undefined;
    const hasColor = style.color !== undefined || style.targetColor !== undefined;
    const hasFill = style.fill !== undefined;
    const locked = !!d.locked;
    const hidden = !!d.hidden;
    return (
      <div
        ref={selectionToolbarRef}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute", zIndex: 21, transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 1,
          background: "#2B2F36", border: "1px solid #333", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "4px 5px",
        }}
      >
        <button type="button" onClick={() => openProperties(d)} title="كل الإعدادات" style={selToolBtnStyle}><ToolIcon id="kebab" /></button>
        <button type="button" onClick={deleteSelectedDrawing} title="حذف" style={{ ...selToolBtnStyle, color: RED }}><ToolIcon id="trash" /></button>
        <button type="button" onClick={toggleSelectedLock} title={locked ? "فك القفل" : "قفل (منع التحريك)"} style={{ ...selToolBtnStyle, color: locked ? GOLD_LIGHT : "#ccc" }}>
          <ToolIcon id={locked ? "lock" : "unlock"} />
        </button>
        <button type="button" onClick={duplicateSelectedDrawing} title="نسخ" style={selToolBtnStyle}><ToolIcon id="copy2" /></button>
        <button type="button" onClick={toggleSelectedHidden} title={hidden ? "إظهار هاي الرسمة" : "إخفاء هاي الرسمة"} style={{ ...selToolBtnStyle, color: hidden ? GOLD_LIGHT : "#ccc" }}><ToolIcon id="hexagonEye" /></button>
        <span style={selToolDivider} />
        {hasColor && (
          <label title="لون الخط/الإطار" style={{ ...selToolBtnStyle, position: "relative" }}>
            <ToolIcon id="pencilLine" />
            <input
              type="color"
              value={style.color || style.targetColor || GOLD_LIGHT}
              onChange={(e) => updateSelectedStyle({ color: e.target.value })}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", padding: 0, border: "none" }}
            />
          </label>
        )}
        {hasWidth && (
          <select
            value={style.width || 1.5}
            onChange={(e) => updateSelectedStyle({ width: Number(e.target.value) })}
            title="السماكة"
            style={{ ...selectStyle, minWidth: 0, width: 56, padding: "0.3rem 0.35rem", fontSize: 12 }}
          >
            {[1, 1.5, 2, 3, 4].map((w) => (<option key={w} value={w}>{w}px</option>))}
          </select>
        )}
        {hasFill && (
          <label title="لون التعبئة" style={{ ...selToolBtnStyle, position: "relative" }}>
            <ToolIcon id="paintbucket" />
            <input
              type="color"
              value={style.fillColor || style.color || GOLD_LIGHT}
              onChange={(e) => updateSelectedStyle({ fillColor: e.target.value, fill: true })}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", padding: 0, border: "none" }}
            />
          </label>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openQuickTextPopover(); }}
          title="إضافة/تعديل نص على الرسمة مباشرة"
          style={{ ...selToolBtnStyle, color: textPopoverOpen ? GOLD_LIGHT : "#ccc", fontWeight: 800, fontFamily: "serif" }}
        >
          T
        </button>
        {textPopoverOpen && renderQuickTextPopover()}
        <span style={selToolDivider} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setTextPopoverOpen(false); setDrawingTemplatesMenuOpen((v) => !v); }}
          title="قوالب: احفظي أو طبّقي شكل الرسمة"
          style={{ ...selToolBtnStyle, color: drawingTemplatesMenuOpen ? GOLD_LIGHT : "#ccc" }}
        >
          <ToolIcon id="templatePlus" />
        </button>
        {drawingTemplatesMenuOpen && renderDrawingTemplatesMenu(d)}
        <span
          onMouseDown={onToolbarDragStart}
          style={{ ...selToolBtnStyle, cursor: "grab", color: "#555" }}
          title="اسحبي لتحريك الشريط"
        >
          <ToolIcon id="dragDots" />
        </span>
      </div>
    );
  }

  /* نافذة صغيرة عائمة لكتابة/تعديل النص على الرسمة المختارة فوراً، من غير الحاجة
     نفوّت على لوحة "كل الإعدادات" الكاملة */
  function renderQuickTextPopover() {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          zIndex: 26, minWidth: 220,
          background: "#171b26", border: "1px solid #242832", borderRadius: 10,
          boxShadow: "0 8px 28px rgba(0,0,0,0.55)", padding: 10,
        }}
      >
        <input
          autoFocus
          type="text"
          value={textPopoverValue}
          onChange={(e) => setTextPopoverValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyQuickText();
            if (e.key === "Escape") setTextPopoverOpen(false);
          }}
          placeholder="اكتبي النص هون..."
          style={{ ...selectStyle, width: "100%", minWidth: 0 }}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button type="button" onClick={applyQuickText} style={{ ...btnStyle("primary"), flex: 1, padding: "5px 0", fontSize: 12 }}>حفظ</button>
          <button type="button" onClick={() => setTextPopoverOpen(false)} style={{ ...btnStyle("secondary"), flex: 1, padding: "5px 0", fontSize: 12 }}>إلغاء</button>
        </div>
      </div>
    );
  }

  /* قائمة قوالب شكل الرسمة (زي تريدنغ فيو): حفظ الشكل الحالي باسم، تطبيق
     القالب الافتراضي المعلّم لهاد النوع، وقائمة كل القوالب المحفوظة لنفس
     نوع الرسمة (كل وحدة فيها زر تطبيق + تعليم كافتراضي + حذف) */
  function renderDrawingTemplatesMenu(d) {
    const type = d.type;
    const allTemplates = loadDrawingTemplates();
    const templates = allTemplates.filter((t) => t.type === type);
    let defaultName = null;
    try { defaultName = window.localStorage.getItem(`qta_default_drawing_template_${type}`); } catch {}
    function refresh() {
      setDrawingTemplatesMenuOpen(false);
      setDrawingTemplatesMenuOpen(true);
    }
    function saveAsTemplate() {
      const name = window.prompt("احفظي نموذج الرسم بإسم:", `قالب ${templates.length + 1}`);
      if (!name) return;
      const next = [...allTemplates.filter((t) => !(t.type === type && t.name === name)), { type, name, style: d.style, text: d.text || null }];
      saveDrawingTemplates(next);
      refresh();
    }
    function applyDefaultTemplate() {
      const t = defaultName ? templates.find((tt) => tt.name === defaultName) : null;
      const patch = t ? { ...t.style } : defaultStyleFor(type);
      pushHistory();
      updateSelectedStyle(patch, { remember: false });
      if (t && t.text != null) {
        const idx = drawingsRef.current.findIndex((dr) => dr.id === selectedIdRef.current);
        if (idx !== -1) drawingsRef.current[idx] = { ...drawingsRef.current[idx], text: t.text };
      }
      setDrawingTemplatesMenuOpen(false);
    }
    function applyTemplate(t) {
      pushHistory();
      updateSelectedStyle({ ...t.style }, { remember: false });
      const idx = drawingsRef.current.findIndex((dr) => dr.id === selectedIdRef.current);
      if (idx !== -1) drawingsRef.current[idx] = { ...drawingsRef.current[idx], text: t.text ?? drawingsRef.current[idx].text };
      setDrawingTemplatesMenuOpen(false);
    }
    function setAsDefault(t) {
      try { window.localStorage.setItem(`qta_default_drawing_template_${type}`, t.name); } catch {}
      refresh();
    }
    function removeTemplate(t) {
      saveDrawingTemplates(allTemplates.filter((tt) => !(tt.type === type && tt.name === t.name)));
      if (defaultName === t.name) {
        try { window.localStorage.removeItem(`qta_default_drawing_template_${type}`); } catch {}
      }
      refresh();
    }
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          zIndex: 25, minWidth: 250, maxHeight: 340, overflowY: "auto",
          background: "#171b26", border: "1px solid #242832", borderRadius: 10,
          boxShadow: "0 8px 28px rgba(0,0,0,0.55)", padding: "6px 0",
        }}
      >
        <div onClick={saveAsTemplate} style={templateMenuItemStyle}>حفظ نموذج الرسم بإسم...</div>
        <div onClick={applyDefaultTemplate} style={templateMenuItemStyle}>تطبيق نموذج القالب الافتراضي للرسوم</div>
        {templates.length > 0 && <div style={{ height: 1, background: "#242832", margin: "4px 0" }} />}
        {templates.map((t) => (
          <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>
            <div onClick={() => applyTemplate(t)} style={{ flex: 1, cursor: "pointer", fontSize: 13, color: "#e5e5e5", padding: "5px 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.name}
            </div>
            <span
              onClick={() => setAsDefault(t)}
              title={defaultName === t.name ? "القالب الافتراضي الحالي" : "تعيين كافتراضي"}
              style={{ cursor: "pointer", fontSize: 14, color: defaultName === t.name ? GOLD_LIGHT : "#4a4e58" }}
            >
              {defaultName === t.name ? "★" : "☆"}
            </span>
            <span onClick={() => removeTemplate(t)} title="حذف القالب" style={{ cursor: "pointer", color: "#888", fontSize: 12 }}>✕</span>
          </div>
        ))}
        {templates.length === 0 && (
          <div style={{ padding: "8px 14px", fontSize: 12, color: "#777" }}>ما في قوالب محفوظة لهاد النوع لسا</div>
        )}
      </div>
    );
  }

  /* أدوات التحكم (الأصل/الفريم/السرعة + أزرار الاستعراض) */
  /* لوحة تأكيد الصفقة الفورية: بتظهر بعد الضغط على شراء/بيع، فيها اللوت وأسعار الهدف/الإيقاف
     (بتتحدث لحظياً وقت ما تسحبي الخطين عالشارت) وزرّي تأكيد/إلغاء */
  /* ===== سحب لوحة تأكيد الصفقة (Trade Confirmation Panel) لأي مكان =====
     null = المكان الافتراضي (أعلى يمين). بعد أول سحب بتصير {x,y} بالبكسل
     نسبة لمنطقة الشارت (chartAreaRef)، وبتضل ثابتة أثناء الجلسة حتى لو
     تحدّث الشارت أو تغيّر الفريم (State مستقلة تماماً عن أي منهم). */
  const [tradePanelPos, setTradePanelPos] = useState(null);
  const [isDraggingTradePanel, setIsDraggingTradePanel] = useState(false);
  const tradePanelDragRef = useRef(null);
  function onTradePanelDragStart(e) {
    e.preventDefault();
    const areaRect = chartAreaRef.current?.getBoundingClientRect();
    if (!areaRect) return;
    const panelEl = e.currentTarget.closest("[data-trade-panel]");
    const panelRect = panelEl?.getBoundingClientRect();
    const curLeft = tradePanelPos ? tradePanelPos.x : (panelRect ? panelRect.left - areaRect.left : areaRect.width - 274);
    const curTop = tradePanelPos ? tradePanelPos.y : (panelRect ? panelRect.top - areaRect.top : 10);
    tradePanelDragRef.current = {
      startClientX: e.clientX, startClientY: e.clientY, startLeft: curLeft, startTop: curTop,
      areaW: areaRect.width, areaH: areaRect.height,
      panelW: panelRect?.width || 260, panelH: panelRect?.height || 300,
    };
    setIsDraggingTradePanel(true);
    window.addEventListener("mousemove", onTradePanelDragMove);
    window.addEventListener("mouseup", onTradePanelDragEnd);
  }
  function onTradePanelDragMove(e) {
    const d = tradePanelDragRef.current;
    if (!d) return;
    let nx = d.startLeft + (e.clientX - d.startClientX);
    let ny = d.startTop + (e.clientY - d.startClientY);
    // منمنعها تخرج بالكامل برا حدود منطقة الشارت - بيضل جزء صغير مرئي عالأقل
    const margin = 32;
    nx = Math.max(-d.panelW + margin, Math.min(nx, d.areaW - margin));
    ny = Math.max(0, Math.min(ny, d.areaH - margin));
    setTradePanelPos({ x: nx, y: ny });
  }
  function onTradePanelDragEnd() {
    tradePanelDragRef.current = null;
    setIsDraggingTradePanel(false);
    window.removeEventListener("mousemove", onTradePanelDragMove);
    window.removeEventListener("mouseup", onTradePanelDragEnd);
  }

  function renderTradePanel() {
    if (!pendingTrade) return null;
    const tpLine = drawingsRef.current.find((d) => d.tradeTag === pendingTrade.tag && d.tradeRole === "tp");
    const slLine = drawingsRef.current.find((d) => d.tradeTag === pendingTrade.tag && d.tradeRole === "sl");
    const tp = tpLine?.p1.price, sl = slLine?.p1.price;
    const lot = parseFloat(tradeLot) || 0;
    const info = getAssetByValue(pendingTrade.asset);
    const mult = info?.mult || 1;
    const riskAmount = sl != null ? Math.abs(pendingTrade.entry - sl) * lot * mult : 0;
    const rewardAmount = tp != null ? Math.abs(tp - pendingTrade.entry) * lot * mult : 0;
    const rrNum = riskAmount > 0 ? rewardAmount / riskAmount : 0;
    const rr = riskAmount > 0 ? rrNum.toFixed(2) : "-";
    const isBuy = pendingTrade.direction === "buy";
    return (
      <div data-trade-panel style={{
        position: "absolute",
        ...(tradePanelPos ? { left: tradePanelPos.x, top: tradePanelPos.y } : { top: 10, right: 10 }),
        zIndex: 12, width: 260,
        background: "#161616", border: `1px solid ${isBuy ? GREEN : RED}66`, borderRadius: 12,
        padding: 14, boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
      }}>
        {/* Header قابل للسحب - نفس سطر العنوان، مع مقبض واضح وcursor يتغيّر أثناء السحب */}
        <div
          onMouseDown={onTradePanelDragStart}
          title="اسحبي من هون لتحريك اللوحة"
          style={{
            fontWeight: 700, color: isBuy ? GREEN : RED, marginBottom: 8, fontSize: 14,
            display: "flex", alignItems: "center", gap: 6, cursor: isDraggingTradePanel ? "grabbing" : "grab",
            userSelect: "none", margin: "-4px -4px 8px", padding: "4px 4px",
          }}
        >
          <span style={{ opacity: 0.5, fontSize: 12, letterSpacing: 1 }}>⠿</span>
          {isBuy ? "🟢 صفقة شراء" : "🔴 صفقة بيع"} — {pendingTrade.asset}
        </div>

        {/* أسعار الدخول/الهدف/الإيقاف قابلة للتعديل كتابياً هون مباشرة، وبتتزامن
            مع الخطوط عالشارت لحظياً بالاتجاهين (سحب الخط ↔ كتابة رقم) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={numFieldLabelStyle}>
            سعر الدخول
            <input
              type="number" step="any" value={entryText}
              onFocus={() => { entryFocusedRef.current = true; }}
              onBlur={() => { entryFocusedRef.current = false; setEntryText(pendingTradeRef.current ? pendingTradeRef.current.entry.toFixed(2) : ""); }}
              onChange={(e) => handleEntryTextChange(e.target.value)}
              style={{ ...selectStyle, minWidth: 0, width: "100%", color: GOLD_LIGHT, fontWeight: 700 }}
            />
          </label>
          <label style={numFieldLabelStyle}>
            🎯 الهدف (TP)
            <input
              type="number" step="any" value={tpText}
              onFocus={() => { tpFocusedRef.current = true; }}
              onBlur={() => { tpFocusedRef.current = false; const l = drawingsRef.current.find((d) => d.tradeTag === pendingTradeRef.current?.tag && d.tradeRole === "tp"); setTpText(l ? l.p1.price.toFixed(2) : ""); }}
              onChange={(e) => handleTpTextChange(e.target.value)}
              style={{ ...selectStyle, minWidth: 0, width: "100%", color: GREEN, fontWeight: 700 }}
            />
          </label>
          <label style={numFieldLabelStyle}>
            ⛔ الإيقاف (SL)
            <input
              type="number" step="any" value={slText}
              onFocus={() => { slFocusedRef.current = true; }}
              onBlur={() => { slFocusedRef.current = false; const l = drawingsRef.current.find((d) => d.tradeTag === pendingTradeRef.current?.tag && d.tradeRole === "sl"); setSlText(l ? l.p1.price.toFixed(2) : ""); }}
              onChange={(e) => handleSlTextChange(e.target.value)}
              style={{ ...selectStyle, minWidth: 0, width: "100%", color: RED, fontWeight: 700 }}
            />
          </label>
        </div>

        {/* شريط بصري لنسبة المخاطرة/العائد - بيبيّن مباشرة نسبة R:R بشكل رسمة، مش بس رقم */}
        <div style={{ margin: "10px 0 2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#999", marginBottom: 3 }}>
            <span style={{ color: RED }}>مخاطرة ${riskAmount.toFixed(2)}</span>
            <span style={{ color: GOLD_LIGHT, fontWeight: 700 }}>R:R — 1:{rr}</span>
            <span style={{ color: GREEN }}>عائد ${rewardAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", border: "1px solid #333", background: "#0e0e0e" }}>
            {(() => {
              const safeRr = isNaN(rrNum) || rrNum <= 0 ? 0 : Math.min(rrNum, 6);
              const total = 1 + safeRr;
              const riskPct = (1 / total) * 100;
              const rewardPct = (safeRr / total) * 100;
              return (
                <>
                  <div style={{ width: `${riskPct}%`, background: RED }} />
                  <div style={{ width: `${rewardPct}%`, background: GREEN }} />
                </>
              );
            })()}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#888", margin: "6px 0 4px" }}>
          فيكي تكتبي الأرقام هون مباشرة أو تسحبي خط الهدف الأخضر/خط الإيقاف الأحمر عالشارت
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999", marginTop: 6 }}>
          اللوت
          <input
            type="number" step="0.01" min="0.01" value={tradeLot}
            onChange={(e) => setTradeLot(e.target.value)}
            style={{ ...selectStyle, minWidth: 0, width: "100%" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999", marginTop: 8 }}>
          سبب الدخول
          <textarea
            value={tradeReason}
            onChange={(e) => setTradeReason(e.target.value)}
            placeholder="ليش دخلتي هالصفقة؟ (بينسجل مع الصفقة بالباك تست)"
            rows={2}
            style={{
              ...selectStyle, minWidth: 0, width: "100%", resize: "vertical",
              fontFamily: "inherit", padding: "6px 8px", lineHeight: 1.4,
            }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={confirmQuickTrade} disabled={savingTrade || !tradeReason.trim()} style={{ ...btnStyle("primary"), flex: 1, opacity: !tradeReason.trim() ? 0.5 : 1 }}>
            {savingTrade ? "...جاري الحفظ" : "✔ تأكيد وتسجيل"}
          </button>
          <button onClick={cancelQuickTrade} disabled={savingTrade} style={{ ...btnStyle("secondary"), flex: 1 }}>
            ✕ إلغاء
          </button>
        </div>
      </div>
    );
  }

  /* لوحة صغيرة تعرض الصفقات المفتوحة حالياً وتسمح بتعديل الهدف/الإيقاف تبعها كتابياً
     حتى بعد ما اتأكدت وانسجلت (التعديل بينحفظ فوراً بقاعدة البيانات) */
  function renderOpenPositionsPanel() {
    if (!openPositionsList.length) return null;
    return (
      <div style={{
        position: "absolute", top: 10, left: 10, zIndex: 11, width: 230,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {openPositionsList.map((pos) => {
          const isBuy = pos.direction === "buy";
          const edits = openPosEdits[pos.dbId] || { tp: pos.tp.toFixed(2), sl: pos.sl.toFixed(2) };
          return (
            <div key={pos.dbId} style={{
              background: "#161616", border: `1px solid ${isBuy ? GREEN : RED}55`, borderRadius: 10,
              padding: 10, boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: isBuy ? GREEN : RED, marginBottom: 6 }}>
                {isBuy ? "🟢 صفقة مفتوحة" : "🔴 صفقة مفتوحة"} — {pos.asset}
              </div>
              <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>
                الدخول: <b style={{ color: GOLD_LIGHT }}>{pos.entry.toFixed(2)}</b>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <label style={{ ...numFieldLabelStyle, flex: 1 }}>
                  🎯 TP
                  <input
                    type="number" step="any" value={edits.tp}
                    onFocus={() => { openPosFocusRef.current[pos.dbId + "_tp"] = true; }}
                    onBlur={() => { openPosFocusRef.current[pos.dbId + "_tp"] = false; setOpenPosEdits((p) => ({ ...p, [pos.dbId]: { ...p[pos.dbId], tp: pos.tp.toFixed(2) } })); }}
                    onChange={(e) => handleOpenPosFieldChange(pos, "tp", e.target.value)}
                    style={{ ...selectStyle, minWidth: 0, width: "100%", color: GREEN, fontSize: 12, padding: "4px 6px" }}
                  />
                </label>
                <label style={{ ...numFieldLabelStyle, flex: 1 }}>
                  ⛔ SL
                  <input
                    type="number" step="any" value={edits.sl}
                    onFocus={() => { openPosFocusRef.current[pos.dbId + "_sl"] = true; }}
                    onBlur={() => { openPosFocusRef.current[pos.dbId + "_sl"] = false; setOpenPosEdits((p) => ({ ...p, [pos.dbId]: { ...p[pos.dbId], sl: pos.sl.toFixed(2) } })); }}
                    onChange={(e) => handleOpenPosFieldChange(pos, "sl", e.target.value)}
                    style={{ ...selectStyle, minWidth: 0, width: "100%", color: RED, fontSize: 12, padding: "4px 6px" }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* توست صغير لتأكيد/تنبيه نتيجة عمليات الصفقة الفورية */
  function renderTradeToast() {
    if (!tradeToast) return null;
    return (
      <div style={{
        position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 15,
        background: "#161616", border: `1px solid ${GOLD}55`, borderRadius: 10,
        padding: "0.55rem 1rem", fontSize: 12.5, color: "#eee", boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        maxWidth: "90%", textAlign: "center",
      }}>
        {tradeToast}
      </div>
    );
  }

  /* قائمة الكليك يمين عالشارت (ستايل تريدنغ فيو): شراء/بيع فوري بالسعر يلي ضغطتي عليه،
     نسخ السعر، إعادة تعيين الشارت، إعدادات الألوان، حذف الرسومات */
  function renderContextMenu() {
    if (!contextMenu) return null;
    const price = contextMenu.price;
    const item = (label, onClick, extra) => (
      <div
        onClick={() => { onClick(); setContextMenu(null); }}
        style={{
          padding: "9px 14px", fontSize: 13, color: "#e5e5e5", cursor: "pointer",
          display: "flex", justifyContent: "space-between", gap: 10, whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#262626")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span>{label}</span>
        {extra && <span style={{ color: "#888" }}>{extra}</span>}
      </div>
    );
    const sep = <div style={{ height: 1, background: "#2A2E39", margin: "5px 0" }} />;
    return (
      <div
        style={{
          position: "absolute", top: contextMenu.y, left: contextMenu.x, zIndex: 20,
          background: "#2B2F36", border: "1px solid #333", borderRadius: 10, padding: "6px 0",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)", minWidth: 220,
        }}
      >
        {price != null && (
          <>
            {item("🟢 شراء فوري هون", () => openQuickTrade("buy", price), price.toFixed(2))}
            {item("🔴 بيع فوري هون", () => openQuickTrade("sell", price), price.toFixed(2))}
            {item("نسخ السعر", () => navigator.clipboard?.writeText(price.toFixed(2)))}
            {sep}
          </>
        )}
        {item("⟲ إعادة تعيين الشارت", handleResetView)}
        {item(drawingsVisible ? "إخفاء الرسومات" : "إظهار الرسومات", toggleDrawingsVisible)}
        {item("🗑 حذف كل الرسومات", handleClearDrawings)}
        {sep}
        {item("⚙️ إعدادات الألوان", () => setSettingsOpen(true))}
      </div>
    );
  }

  /* نافذة إعدادات الشارت الكاملة — ستايل تريدنغ فيو بالظبط: قائمة تبويبات عالجانب
     (رمز / خط الحالة / المقاييس والخطوط / لوحة / تداول / تنبيهات / أحداث) ومحتوى كل
     تبويب بمنطقة قابلة للتمرير لحالها. كل تغيير بينطبق فوراً وبينحفظ محلياً بالمتصفح. */
  /* شريط صغير أعلى يسار الشارت يعرض شرائح (chips) لكل مؤشر مفعّل حالياً - كل
     شريحة فيها لون المؤشر + اسمه المختصر، وبفتحلها قائمة سريعة (عين/إعدادات/حذف)
     بالضغط عليها - بالظبط متل قائمة الأدوات السريعة بمنصات التداول المعروفة */
  function renderActiveIndicatorsBar() {
    return (
      <div
        style={{
          position: "absolute", top: 84, left: 10, zIndex: 7,
          display: "flex", flexWrap: "wrap", gap: 5, maxWidth: "70%",
          pointerEvents: "auto",
        }}
      >
        {activeIndicators.map((it) => {
          const def = getIndicatorDef(it.id);
          if (!def) return null;
          const hidden = it.style?.visible === false;
          const mainColor = def.lines[0]?.color || GOLD;
          const menuOpen = indicatorQuickMenuFor === it.instanceId;
          return (
            <div key={it.instanceId} style={{ position: "relative" }}>
              <div
                onClick={() => setIndicatorQuickMenuFor((cur) => (cur === it.instanceId ? null : it.instanceId))}
                title="اضغطي لخيارات سريعة (إظهار/إعدادات/حذف)"
                style={{
                  display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
                  background: menuOpen ? "rgba(30,28,18,0.9)" : "rgba(13,13,10,0.72)", backdropFilter: "blur(2px)",
                  border: `1px solid ${menuOpen ? GOLD + "88" : GOLD + "22"}`, borderRadius: 6,
                  padding: "2px 4px 2px 6px", fontSize: 11, color: hidden ? "#777" : "#ddd",
                  opacity: hidden ? 0.6 : 1,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: mainColor, flexShrink: 0 }} />
                <span>{def.name}{def.params?.[0] ? ` (${it.params[def.params[0].key]})` : ""}</span>
              </div>
              {menuOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setIndicatorQuickMenuFor(null)} />
                  <div
                    style={{
                      position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 10,
                      display: "flex", alignItems: "center", gap: 2, background: "#2B2F36",
                      border: `1px solid ${GOLD}33`, borderRadius: 8, padding: 3,
                      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                    }}
                  >
                    <button type="button" title={hidden ? "إظهار" : "إخفاء"} onClick={(e) => { e.stopPropagation(); toggleIndicatorVisible(it.instanceId); }} style={{ ...quickMenuBtnStyle }}>
                      <ToolIcon id={hidden ? "eyeOff" : "eye"} />
                    </button>
                    <button
                      type="button" title="الإعدادات"
                      onClick={(e) => { e.stopPropagation(); setIndicatorSettingsFor(it.instanceId); setIndicatorSettingsTab("visibility"); setIndicatorQuickMenuFor(null); }}
                      style={{ ...quickMenuBtnStyle }}
                    >
                      <ToolIcon id="gear" />
                    </button>
                    <div style={{ width: 1, height: 18, background: "#333" }} />
                    <button type="button" title="حذف المؤشر" onClick={(e) => { e.stopPropagation(); removeIndicator(it.instanceId); }} style={{ ...quickMenuBtnStyle, color: RED }}>
                      <ToolIcon id="trash" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* نافذة اختيار وإدارة المؤشرات: بحث بأي اسم/اختصار + قائمة كل المؤشرات
     مبوّبة (فوق السعر / لوحة مستقلة) + قسم "المضافة حالياً" لتعديل فتراتها أو حذفها */
  function renderIndicatorPanel() {
    const results = searchIndicators(indicatorSearch);
    const overlays = results.filter((d) => d.type === "overlay");
    const oscillators = results.filter((d) => d.type === "oscillator");
    const indicatorRow = (def) => (
      <div
        key={def.id}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 6px", borderBottom: "1px solid #232323", gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: def.lines[0]?.color || GOLD, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#e5e5e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{def.name}</span>
        </div>
        <button type="button" onClick={() => addIndicator(def.id)} style={{ ...btnStyle("secondary"), padding: "0.3rem 0.7rem", fontSize: 12, flexShrink: 0 }}>
          + إضافة
        </button>
      </div>
    );
    return (
      <div
        style={{ position: "absolute", inset: 0, zIndex: 30, background: "#0B0E11aa", display: "flex", alignItems: "center", justifyContent: "center" }}
        onClick={() => setIndicatorPanelOpen(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 480, maxWidth: "92%", maxHeight: "82%", background: "#161616",
            border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1.1rem 1.3rem",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}
        >
          <div style={{ fontWeight: 700, color: GOLD_LIGHT, marginBottom: 10, fontSize: 15, flexShrink: 0 }}>📈 المؤشرات الفنية</div>

          <input
            type="text"
            value={indicatorSearch}
            onChange={(e) => setIndicatorSearch(e.target.value)}
            placeholder="ابحثي عن أي مؤشر (بالعربي أو الانجليزي)... مثال: RSI, ماكد, بولينجر"
            style={{
              background: "#0d0d0d", border: "1px solid #333", borderRadius: 8, color: "#eee",
              padding: "0.55rem 0.7rem", fontSize: 13, marginBottom: 10, flexShrink: 0,
            }}
          />

          {activeIndicators.length > 0 && (
            <div style={{ flexShrink: 0, marginBottom: 10, maxHeight: "34%", overflowY: "auto", border: `1px solid ${GOLD}22`, borderRadius: 8, padding: "0.4rem 0.6rem" }}>
              <div style={{ fontSize: 11.5, color: "#777", fontWeight: 700, marginBottom: 4 }}>مضافة حالياً ({activeIndicators.length})</div>
              {activeIndicators.map((it) => {
                const def = getIndicatorDef(it.id);
                if (!def) return null;
                return (
                  <div key={it.instanceId} style={{ padding: "6px 0", borderBottom: "1px solid #232323" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12.5, color: "#e5e5e5" }}>{def.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => { setIndicatorSettingsFor(it.instanceId); setIndicatorSettingsTab("style"); }}
                          title="إعدادات كاملة (الظهور/نمط/مدخلات)"
                          style={{ ...paneCornerBtnStyle, fontSize: 13 }}
                        >⚙️</button>
                        <button type="button" onClick={() => removeIndicator(it.instanceId)} style={{ ...paneCornerBtnStyle, color: RED, fontSize: 12 }}>حذف ✕</button>
                      </div>
                    </div>
                    {(def.params || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                        {def.params.map((f) => (
                          <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#999" }}>
                            {f.label}
                            <input
                              type="number"
                              value={it.params[f.key]}
                              min={f.min} max={f.max} step={f.step || 1}
                              onChange={(e) => updateIndicatorParam(it.instanceId, f.key, Number(e.target.value))}
                              style={{ width: 56, background: "#0d0d0d", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: "3px 5px", fontSize: 11.5, textAlign: "center" }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {overlays.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: "#777", fontWeight: 700, margin: "6px 0 2px" }}>مؤشرات فوق السعر</div>
                {overlays.map(indicatorRow)}
              </>
            )}
            {oscillators.length > 0 && (
              <>
                <div style={{ fontSize: 11.5, color: "#777", fontWeight: 700, margin: "12px 0 2px" }}>مؤشرات بلوحة مستقلة (زخم/تذبذب)</div>
                {oscillators.map(indicatorRow)}
              </>
            )}
            {results.length === 0 && (
              <div style={{ fontSize: 12.5, color: "#777", padding: "1rem 0", textAlign: "center" }}>ما لقينا أي مؤشر بهالاسم</div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexShrink: 0 }}>
            <button onClick={() => setIndicatorPanelOpen(false)} style={{ ...btnStyle("primary"), flex: 1 }}>تم</button>
          </div>
        </div>
      </div>
    );
  }

  /* نافذة إعدادات مؤشر واحد مفعّل - بتبويبات أفقية فوق (الظهور / نمط / مدخلات)
     بالظبط متل نوافذ الخصائص بمنصات التداول المعروفة: تبويب "الظهور" لإخفاء/إظهار
     المؤشر، "نمط" لتغيير لون وسماكة كل خط فيه، و"مدخلات" لفتراته الرقمية (زي فترة SMA...الخ) */
  function renderIndicatorSettingsDialog() {
    const it = activeIndicators.find((x) => x.instanceId === indicatorSettingsFor);
    if (!it) return null;
    const def = getIndicatorDef(it.id);
    if (!def) return null;
    const hidden = it.style?.visible === false;
    const SETTINGS_TABS = [
      { key: "visibility", label: "الظهور" },
      { key: "style", label: "نمط" },
      { key: "inputs", label: "مدخلات" },
    ];
    const close = () => setIndicatorSettingsFor(null);
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 32, background: "#0B0E11aa", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={close}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 420, maxWidth: "92%", maxHeight: "82%", background: "#161616",
            border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1rem 1.2rem",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexShrink: 0 }}>
            <div style={{ fontWeight: 700, color: GOLD_LIGHT, fontSize: 15 }}>{def.name}</div>
            <button onClick={close} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>

          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #262626", marginBottom: 12, flexShrink: 0 }}>
            {SETTINGS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setIndicatorSettingsTab(t.key)}
                style={{
                  padding: "7px 14px", border: "none", background: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: indicatorSettingsTab === t.key ? 700 : 500,
                  color: indicatorSettingsTab === t.key ? GOLD_LIGHT : "#999",
                  borderBottom: `2px solid ${indicatorSettingsTab === t.key ? GOLD : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {indicatorSettingsTab === "visibility" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                <span style={{ fontSize: 13, color: "#ccc" }}>إظهار المؤشر على الشارت</span>
                <input
                  type="checkbox" checked={!hidden}
                  onChange={() => toggleIndicatorVisible(it.instanceId)}
                  style={{ width: 18, height: 18, cursor: "pointer", accentColor: GOLD }}
                />
              </div>
            )}

            {indicatorSettingsTab === "style" && (
              <div>
                {def.lines.map((line) => (
                  <div key={line.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #232323", gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: "#e5e5e5" }}>{line.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="color"
                        value={effectiveLineColor(it, line)}
                        onChange={(e) => updateIndicatorLineColor(it.instanceId, line.key, e.target.value)}
                        style={{ width: 34, height: 26, border: "1px solid #333", borderRadius: 6, background: "none", cursor: "pointer", padding: 0 }}
                      />
                      {!line.isHistogram && (
                        <select
                          value={effectiveLineWidth(it, line)}
                          onChange={(e) => updateIndicatorLineWidth(it.instanceId, line.key, Number(e.target.value))}
                          style={{ ...selectStyle, padding: "4px 6px", fontSize: 12 }}
                        >
                          {[1, 2, 3, 4].map((w) => (<option key={w} value={w}>{w}px</option>))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {indicatorSettingsTab === "inputs" && (
              (def.params || []).length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {def.params.map((f) => (
                    <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #232323" }}>
                      <span style={{ fontSize: 12.5, color: "#ccc" }}>{f.label}</span>
                      <input
                        type="number"
                        value={it.params[f.key]}
                        min={f.min} max={f.max} step={f.step || 1}
                        onChange={(e) => updateIndicatorParam(it.instanceId, f.key, Number(e.target.value))}
                        style={{ width: 70, background: "#0d0d0d", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: "5px 7px", fontSize: 12.5, textAlign: "center" }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "#777", padding: "1rem 0", textAlign: "center" }}>هاد المؤشر ما إله مدخلات قابلة للتعديل</div>
              )
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexShrink: 0 }}>
            <button
              onClick={() => { removeIndicator(it.instanceId); }}
              style={{ ...btnStyle("secondary"), color: RED, flex: 1 }}
            >🗑 حذف المؤشر</button>
            <button onClick={close} style={{ ...btnStyle("primary"), flex: 1 }}>تم</button>
          </div>
        </div>
      </div>
    );
  }

  /* لوحة القوالب: حفظ/تحميل مجموعة المؤشرات المفعّلة حالياً (مع فتراتها وألوانها)
     كقالب باسم مخصص - محفوظة محلياً بالمتصفح، وقابلة للتحميل أو الحذف بأي وقت */
  function renderTemplatesPanel() {
    const templates = loadIndicatorTemplates();
    const close = () => setTemplatesPanelOpen(false);
    function saveCurrentAsTemplate() {
      const name = window.prompt("اسم القالب:", `قالب ${templates.length + 1}`);
      if (!name) return;
      const next = [...templates.filter((t) => t.name !== name), { name, indicators: activeIndicators }];
      saveIndicatorTemplates(next);
      setTemplatesPanelOpen(false);
      setTemplatesPanelOpen(true); // إعادة رندر فوري بالقائمة المحدثة
    }
    function applyTemplate(t) {
      setActiveIndicators(t.indicators.map((it) => ({
        ...it,
        instanceId: `${it.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      })));
      close();
    }
    function deleteTemplate(name) {
      saveIndicatorTemplates(templates.filter((t) => t.name !== name));
      setTemplatesPanelOpen(false);
      setTemplatesPanelOpen(true);
    }
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 31, background: "#0B0E11aa", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={close}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 360, maxWidth: "92%", maxHeight: "78%", background: "#161616",
            border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1.1rem 1.3rem",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}
        >
          <div style={{ fontWeight: 700, color: GOLD_LIGHT, marginBottom: 10, fontSize: 15, flexShrink: 0 }}>🗂 قوالب المؤشرات</div>
          <button onClick={saveCurrentAsTemplate} style={{ ...btnStyle("secondary"), marginBottom: 10, flexShrink: 0 }}>
            + احفظي المجموعة الحالية كقالب ({activeIndicators.length})
          </button>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {templates.length === 0 && (
              <div style={{ fontSize: 12.5, color: "#777", padding: "1rem 0", textAlign: "center" }}>ما في قوالب محفوظة لسا</div>
            )}
            {templates.map((t) => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px", borderBottom: "1px solid #232323", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#e5e5e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#777" }}>{t.indicators.length} مؤشر</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => applyTemplate(t)} style={{ ...btnStyle("primary"), padding: "0.3rem 0.7rem", fontSize: 12 }}>تحميل</button>
                  <button type="button" onClick={() => deleteTemplate(t.name)} style={{ ...paneCornerBtnStyle, color: RED, fontSize: 13 }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexShrink: 0 }}>
            <button onClick={close} style={{ ...btnStyle("primary"), flex: 1 }}>تم</button>
          </div>
        </div>
      </div>
    );
  }

  function renderPracticePanel() {
    const close = () => setPracticePanelOpen(false);
    const drawings = drawingsRef.current; // drawingsListTick يجبر إعادة الرندر بعد كل تعديل
    void drawingsListTick;

    function setRoleMeta(id, patch) {
      setDrawingRoles((prev) => ({
        ...prev,
        [id]: { role: prev[id]?.role || "", price_tolerance: 0.5, candle_tolerance: 2, weight: 20, notes: "", ...prev[id], ...patch },
      }));
    }

    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 31, background: "#0B0E11aa", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={close}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 460, maxWidth: "94%", maxHeight: "86%", background: "#161616",
            border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1.1rem 1.3rem",
            display: "flex", flexDirection: "column", minHeight: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexShrink: 0 }}>
            <div style={{ fontWeight: 700, color: GOLD_LIGHT, fontSize: 15 }}>🎯 تسجيل تمرين تفاعلي (SMC + ICT)</div>
            <button
              onClick={() => setDrawingsListTick((t) => t + 1)}
              style={{ ...paneCornerBtnStyle, fontSize: 11 }}
              title="حدّث القائمة (بعد ما ترسم رسمة جديدة)"
            >
              🔄 تحديث
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: "#999", marginBottom: 10, flexShrink: 0 }}>
            ارسم عادي بأدوات الرسم (مستطيل للـ POI، خط/نقطة للـ SMT والـ CISD...)، وبعدين حدد لكل رسمة شو بتمثل من القائمة تحت. الرسومات بدون دور ما بتنحفظ بمفتاح الإجابة.
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginBottom: 10 }}>
            {drawings.length === 0 && (
              <div style={{ fontSize: 12.5, color: "#777", padding: "1rem 0", textAlign: "center" }}>ما في رسومات بالشارت لسا — ابدأ ارسم</div>
            )}
            {drawings.map((d) => {
              const meta = drawingRoles[d.id] || {};
              return (
                <div key={d.id} style={{ padding: "8px 4px", borderBottom: "1px solid #232323" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 12.5, color: "#e5e5e5" }}>{d.type} <span style={{ color: "#666" }}>#{String(d.id).slice(-4)}</span></div>
                    <select
                      value={meta.role || ""}
                      onChange={(e) => setRoleMeta(d.id, { role: e.target.value })}
                      style={{ ...selectStyle, minWidth: 140, padding: "0.25rem 0.4rem", fontSize: 12 }}
                    >
                      <option value="">— بدون دور —</option>
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {meta.role && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <input
                        type="number" step="0.1" placeholder="هامش السعر"
                        value={meta.price_tolerance ?? 0.5}
                        onChange={(e) => setRoleMeta(d.id, { price_tolerance: parseFloat(e.target.value) || 0 })}
                        style={{ ...selectStyle, width: 90, padding: "0.25rem 0.4rem", fontSize: 11.5 }}
                        title="هامش سماحية بالسعر"
                      />
                      <input
                        type="number" placeholder="هامش الشموع"
                        value={meta.candle_tolerance ?? 2}
                        onChange={(e) => setRoleMeta(d.id, { candle_tolerance: parseInt(e.target.value) || 0 })}
                        style={{ ...selectStyle, width: 90, padding: "0.25rem 0.4rem", fontSize: 11.5 }}
                        title="هامش سماحية بعدد الشموع"
                      />
                      <input
                        type="number" placeholder="الوزن %"
                        value={meta.weight ?? 20}
                        onChange={(e) => setRoleMeta(d.id, { weight: parseFloat(e.target.value) || 0 })}
                        style={{ ...selectStyle, width: 80, padding: "0.25rem 0.4rem", fontSize: 11.5 }}
                        title="وزن هالعنصر بالتقييم"
                      />
                      <input
                        type="text" placeholder="ملاحظة تظهر للطالب لو غلط"
                        value={meta.notes ?? ""}
                        onChange={(e) => setRoleMeta(d.id, { notes: e.target.value })}
                        style={{ ...selectStyle, flex: 1, minWidth: 140, padding: "0.25rem 0.4rem", fontSize: 11.5 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: "1px solid #232323", paddingTop: 10, flexShrink: 0 }}>
            <input
              type="text" placeholder="عنوان السيناريو (مثال: XAUUSD - انعكاس هيكلي 15د)"
              value={scenarioForm.title}
              onChange={(e) => setScenarioForm((f) => ({ ...f, title: e.target.value }))}
              style={{ ...selectStyle, width: "100%", marginBottom: 8, padding: "0.4rem 0.6rem", fontSize: 12.5 }}
            />
            <textarea
              placeholder="وصف مختصر يظهر للطالب قبل ما يبلش (اختياري)"
              value={scenarioForm.description}
              onChange={(e) => setScenarioForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              style={{ ...selectStyle, width: "100%", marginBottom: 8, padding: "0.4rem 0.6rem", fontSize: 12.5, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "#999" }}>الصعوبة:</span>
              <select
                value={scenarioForm.difficulty}
                onChange={(e) => setScenarioForm((f) => ({ ...f, difficulty: e.target.value }))}
                style={{ ...selectStyle, padding: "0.3rem 0.5rem", fontSize: 12 }}
              >
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
              <span style={{ fontSize: 11.5, color: "#666", marginRight: "auto" }}>{taggedDrawings().length} عنصر محدد له دور</span>
            </div>
            {scenarioSaveToast && (
              <div style={{ fontSize: 12, color: GOLD_LIGHT, marginBottom: 8 }}>{scenarioSaveToast}</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={close} style={{ ...btnStyle("secondary"), flex: 1 }}>إغلاق</button>
              <button onClick={saveScenarioAndAnswerKey} disabled={savingScenario} style={{ ...btnStyle("primary"), flex: 2 }}>
                {savingScenario ? "جاري الحفظ..." : "💾 حفظ كسيناريو + مفتاح إجابة"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSettingsDialog() {
    if (!settingsOpen) return null;
    const set = (patch) => setChartSettings((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
    const row = (label, control) => (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #262626", gap: 12 }}>
        <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
        {control}
      </div>
    );
    const sectionTitle = (label) => (
      <div style={{ fontSize: 11.5, color: "#777", margin: "16px 0 2px", fontWeight: 700 }}>{label}</div>
    );
    const colorInput = (val, onChange) => (
      <input type="color" value={val} onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 28, border: "1px solid #333", borderRadius: 6, background: "none", cursor: "pointer", padding: 0 }} />
    );
    const toggleInput = (val, onChange) => (
      <input type="checkbox" checked={val !== false} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, cursor: "pointer", accentColor: GOLD }} />
    );
    const numberInput = (val, onChange, min = 0, max = 40) => (
      <input type="number" min={min} max={max} value={val}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        style={{ width: 60, background: "#0d0d0d", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: "4px 6px", fontSize: 12.5, textAlign: "center" }} />
    );
    const textInput = (val, onChange, placeholder, width = 150) => (
      <input
        type="text" value={val} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width, background: "#0d0d0d", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: "4px 6px", fontSize: 12.5 }}
      />
    );
    const disabledNote = (label) => (
      <div style={{ fontSize: 11.5, color: "#555", padding: "10px 0", borderBottom: "1px solid #262626", fontStyle: "italic" }}>
        {label}
      </div>
    );

    const TABS = [
      { key: "symbol", label: "رمز", icon: "𝍖" },
      { key: "status", label: "خط الحالة", icon: "≡" },
      { key: "scales", label: "المقاييس والخطوط", icon: "↕" },
      { key: "canvas", label: "لوحة", icon: "✎" },
      { key: "trading", label: "تداول", icon: "⤯" },
      { key: "alerts", label: "تنبيهات", icon: "🕐" },
      { key: "events", label: "أحداث", icon: "🗓" },
    ];

    function tabContent() {
      switch (settingsTab) {
        case "symbol":
          return (
            <>
              {sectionTitle("الشموع")}
              {row("لون شمعة الصعود", colorInput(chartSettings.up, (v) => set({ up: v })))}
              {row("لون شمعة الهبوط", colorInput(chartSettings.down, (v) => set({ down: v })))}
              {sectionTitle("القيم على الشارت")}
              {row("إظهار شريط O H L C", toggleInput(chartSettings.ohlcVisible, (v) => set({ ohlcVisible: v })))}
              {row("إظهار آخر قيمة على محور السعر", toggleInput(chartSettings.lastValueLabelVisible, (v) => set({ lastValueLabelVisible: v })))}
            </>
          );
        case "status":
          return (
            <>
              {sectionTitle("الأداة")}
              {row("رمز الأصل", toggleInput(chartSettings.statusShowSymbol, (v) => set({ statusShowSymbol: v })))}
              {row("الفريم الزمني", toggleInput(chartSettings.statusShowInterval, (v) => set({ statusShowInterval: v })))}
              {row("قيم الرسم البياني (O H L C)", toggleInput(chartSettings.statusShowValues, (v) => set({ statusShowValues: v })))}
              {row("خلفية شريط الحالة", toggleInput(chartSettings.statusShowBg, (v) => set({ statusShowBg: v })))}
            </>
          );
        case "scales":
          return (
            <>
              {sectionTitle("النص")}
              {row("لون نص المحاور (الأسعار والوقت)", colorInput(chartSettings.textColor || "#d1d4dc", (v) => set({ textColor: v })))}
              {sectionTitle("مقياس الأسعار")}
              {row("تحجيم تلقائي (Auto Scale)", toggleInput(chartSettings.autoScale, (v) => set({ autoScale: v })))}
              {sectionTitle("هوامش محور السعر (%)")}
              {row("الهامش الأعلى", numberInput(chartSettings.scaleMarginTop, (v) => set({ scaleMarginTop: v })))}
              {row("الهامش الأسفل", numberInput(chartSettings.scaleMarginBottom, (v) => set({ scaleMarginBottom: v })))}
              {sectionTitle("مقياس الوقت")}
              {disabledNote("يتبع توقيت جهازك تلقائياً")}
            </>
          );
        case "canvas":
          return (
            <>
              {sectionTitle("الخلفية")}
              {row("لون خلفية الشارت", colorInput(chartSettings.bg, (v) => set({ bg: v })))}
              {sectionTitle("الشبكة ومؤشر التقاطع")}
              {row("إظهار الشبكة", toggleInput(chartSettings.gridVisible, (v) => set({ gridVisible: v })))}
              {row("لون الشبكة", colorInput(chartSettings.gridColor, (v) => set({ gridColor: v })))}
              {row("لون مؤشر التقاطع", colorInput(chartSettings.crosshairColor, (v) => set({ crosshairColor: v })))}
              {sectionTitle("العلامة المائية")}
              {row("نص العلامة المائية", textInput(chartSettings.watermarkText, (v) => set({ watermarkText: v }), "فارغ = مخفية"))}
            </>
          );
        case "trading":
          return (
            <>
              {sectionTitle("أزرار التداول")}
              {row("إظهار أزرار شراء/بيع فوري", toggleInput(chartSettings.showTradeButtons, (v) => set({ showTradeButtons: v })))}
              {sectionTitle("الحجم الافتراضي")}
              {row("حجم الصفقة (لوت)", textInput(tradeLot, setTradeLot, "0.01", 80))}
              {sectionTitle("ألوان الصفقة (Trade Colors)")}
              {row("لون الدخول (Entry)", colorInput(chartSettings.tradeEntryColor, (v) => set({ tradeEntryColor: v })))}
              {row("لون الهدف (Take Profit)", colorInput(chartSettings.tradeTpColor, (v) => set({ tradeTpColor: v })))}
              {row("لون وقف الخسارة (Stop Loss)", colorInput(chartSettings.tradeSlColor, (v) => set({ tradeSlColor: v })))}
              {row("لون منطقة الربح (Profit Zone)", colorInput(chartSettings.tradeProfitZoneColor, (v) => set({ tradeProfitZoneColor: v })))}
              {row("لون منطقة الخسارة (Loss Zone)", colorInput(chartSettings.tradeLossZoneColor, (v) => set({ tradeLossZoneColor: v })))}
            </>
          );
        case "alerts":
          return (
            <>
              {sectionTitle("رؤية خط الرسم البياني")}
              {row("خطوط التنبيه على الشارت", toggleInput(drawingsVisible, () => toggleDrawingsVisible()))}
              {row("التنبيهات النشطة فقط", toggleInput(chartSettings.activeAlertsOnly, (v) => set({ activeAlertsOnly: v })))}
              {sectionTitle("إشعارات")}
              {row("إخفاء \"التوست\" تلقائياً", toggleInput(chartSettings.autoHideToast, (v) => set({ autoHideToast: v })))}
            </>
          );
        case "events":
          return (
            <>
              {sectionTitle("الأحداث الاقتصادية")}
              {row("إظهار الأحداث على الشارت", toggleInput(chartSettings.showEvents, (v) => set({ showEvents: v })))}
              {disabledNote("تقويم الأحداث الاقتصادية بيوصل قريباً")}
            </>
          );
        default:
          return null;
      }
    }

    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 30, background: "#0B0E11aa",
        display: "flex", alignItems: "center", justifyContent: "center",
      }} onClick={() => setSettingsOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 620, maxWidth: "92%", maxHeight: "82%", background: "#161616",
            border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1.1rem 1.3rem",
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{ fontWeight: 700, color: GOLD_LIGHT, marginBottom: 10, fontSize: 15, flexShrink: 0 }}>⚙️ إعدادات</div>
          <div style={{ display: "flex", flexDirection: "row", gap: 16, flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingLeft: 4 }}>
              {tabContent()}
            </div>
            <div style={{ width: 168, flexShrink: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSettingsTab(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "right",
                    padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: settingsTab === t.key ? "#262626" : "transparent",
                    color: settingsTab === t.key ? GOLD_LIGHT : "#ccc",
                    fontSize: 13, fontWeight: settingsTab === t.key ? 700 : 500,
                  }}
                >
                  <span style={{ width: 18, textAlign: "center", flexShrink: 0 }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexShrink: 0 }}>
            <button onClick={() => setChartSettings(DEFAULT_CHART_SETTINGS)} style={{ ...btnStyle("secondary"), flex: 1 }}>
              الافتراضي
            </button>
            <button onClick={() => setSettingsOpen(false)} style={{ ...btnStyle("primary"), flex: 1 }}>
              تم
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* نافذة إعدادات لوحة المقارنة: نوع الشارت (منطقة/خط/شموع) + ألوانه، بتنطبق فوراً وتنحفظ محلياً */
  function renderCompareSettingsDialog() {
    if (!compareSettingsOpen) return null;
    const row = (label, control) => (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #262626" }}>
        <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
        {control}
      </div>
    );
    const colorInput = (val, onChange) => (
      <input type="color" value={val} onChange={(e) => onChange(e.target.value)}
        style={{ width: 40, height: 28, border: "1px solid #333", borderRadius: 6, background: "none", cursor: "pointer", padding: 0 }} />
    );
    const typeOptions = [
      { value: "area", label: "منطقة (Area)" },
      { value: "line", label: "خط (Line)" },
      { value: "candles", label: "شموع (Candlestick)" },
    ];
    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 30, background: "#0B0E11aa",
        display: "flex", alignItems: "center", justifyContent: "center",
      }} onClick={() => setCompareSettingsOpen(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 300, background: "#161616", border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "1.1rem 1.3rem" }}
        >
          <div style={{ fontWeight: 700, color: GOLD_LIGHT, marginBottom: 6, fontSize: 15 }}>⚙️ إعدادات لوحة المقارنة</div>
          {row("نوع الشارت", (
            <select
              value={compareSettings.type}
              onChange={(e) => setCompareSettings((s) => ({ ...s, type: e.target.value }))}
              style={{ ...selectStyle, minWidth: 140, padding: "0.35rem 0.5rem" }}
            >
              {typeOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          ))}
          {compareSettings.type === "candles" ? (
            <>
              {row("لون شمعة الصعود", colorInput(compareSettings.up, (v) => setCompareSettings((s) => ({ ...s, up: v }))))}
              {row("لون شمعة الهبوط", colorInput(compareSettings.down, (v) => setCompareSettings((s) => ({ ...s, down: v }))))}
            </>
          ) : (
            <>
              {row("لون الخط", colorInput(compareSettings.lineColor, (v) => setCompareSettings((s) => ({ ...s, lineColor: v }))))}
              {compareSettings.type === "area" &&
                row("لون التعبئة", colorInput(compareSettings.fillColor, (v) => setCompareSettings((s) => ({ ...s, fillColor: v }))))}
            </>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => setCompareSettings(DEFAULT_COMPARE_SETTINGS)} style={{ ...btnStyle("secondary"), flex: 1 }}>
              الافتراضي
            </button>
            <button onClick={() => setCompareSettingsOpen(false)} style={{ ...btnStyle("primary"), flex: 1 }}>
              تم
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ملاحظة: renderControls تم دمجها بالكامل جوا renderTopBar (شريط واحد مضغوط
  // بدل صندوقين فوق بعض)، فما عاد في حاجة لها هون.


  /* بادج السوق الحي: سعر + عداد إغلاق الشمعة بتنسيق واضح + شريط تقدّم */
  function renderLiveBadge() {
    return null; // تم إخفاء شريط "مباشر / آخر سعر / إغلاق الشمعة خلال" بناءً على طلب المستخدم
    // eslint-disable-next-line no-unreachable
    if (!(mode === "live" && supported)) return null;
    const priceColor = priceDir === 1 ? GREEN : priceDir === -1 ? RED : GOLD_LIGHT;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "0.8rem",
        background: "#0f1f17", border: `1px solid ${GREEN}44`, borderRadius: 12, padding: "0.7rem 1.2rem",
        flexWrap: "wrap",
      }}>
        <span style={{ color: GREEN, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, display: "inline-block", animation: "qtaPulse 1.4s infinite" }} />
          مباشر
        </span>
        <span style={{ color: "#ccc", fontSize: 13 }}>
          آخر سعر: <b style={{ color: priceColor, transition: "color .3s" }}>{liveLastPrice ? liveLastPrice.toFixed(4) : "..."}</b>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#ccc", fontSize: 13 }}>إغلاق الشمعة خلال:</span>
          <b style={{ color: "#fff", fontVariantNumeric: "tabular-nums", fontSize: 14, minWidth: 58, display: "inline-block" }}>
            {countdown || "--:--"}
          </b>
          <div style={{ width: 90, height: 5, borderRadius: 3, background: "#1f2f27", overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, countdownProgress * 100))}%`,
              height: "100%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
              transition: "width 1s linear",
            }} />
          </div>
        </div>
        <style>{`@keyframes qtaPulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
      </div>
    );
  }

  /* شريط معلومات السعر أعلى الشارت (رمز الأصل + O/H/L/C) — نفس ستايل تريدنغ فيو */
  function renderOHLCTicker() {
    const list = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
    const last = list[list.length - 1];
    if (!last) return null;
    const prev = list[list.length - 2];
    const up = prev ? last.close >= prev.open : last.close >= last.open;
    const col = up ? GREEN : RED;
    const info = getAssetByValue(assetValue);
    const intervalLabel = INTERVALS.find((i) => i.value === interval)?.label || interval;
    const fmt = (v) => (v != null ? v.toFixed(v < 10 ? 4 : 2) : "-");
    const bgStyle = chartSettings.statusShowBg !== false ? "#0B0E1166" : "transparent";
    return (
      <div style={{
        position: "absolute", top: 10, left: 10, zIndex: 8, pointerEvents: "none",
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem 0.7rem",
        fontSize: 12.5, fontFamily: "monospace, sans-serif", direction: "ltr",
      }}>
        {(chartSettings.statusShowSymbol !== false || chartSettings.statusShowInterval !== false) && (
          <span style={{ color: "#eee", fontWeight: 700, background: bgStyle, padding: "2px 8px", borderRadius: 6 }}>
            {chartSettings.statusShowSymbol !== false && (info?.label || assetValue)}
            {chartSettings.statusShowSymbol !== false && chartSettings.statusShowInterval !== false && " · "}
            {chartSettings.statusShowInterval !== false && intervalLabel}
          </span>
        )}
        {chartSettings.statusShowValues !== false && (
          <span ref={ohlcLineRef} style={{ color: col, background: bgStyle, padding: "2px 8px", borderRadius: 6, direction: "ltr" }}>
            O <b ref={ohlcORef}>{fmt(last.open)}</b>&nbsp;&nbsp;H <b ref={ohlcHRef}>{fmt(last.high)}</b>&nbsp;&nbsp;L <b ref={ohlcLRef}>{fmt(last.low)}</b>&nbsp;&nbsp;C <b ref={ohlcCRef}>{fmt(last.close)}</b>
          </span>
        )}
      </div>
    );
  }

  /* لوحة شراء/بيع فوري عائمة فوق الشارت (نفس ستايل تريدنغ فيو تماماً): صندوقين
     صغار جنب بعض (بيع أحمر يمين... بالـRTL بيطلع عالشمال، شراء أزرق) والفرق
     (سبريد) بالنص. هاي بديل أزرار "شراء فوري / بيع فوري" الكبيرة يلي كانت
     آخذة مساحة بشريط الأدوات. */
  function renderQuickTradeWidget() {
    if (chartSettings.showTradeButtons === false) return null;
    if (!supported || allCandles.length === 0) return null;
    const list = mode === "training" ? allCandles.slice(0, revealCount) : allCandles;
    const last = list[list.length - 1];
    if (!last) return null;
    const SPREAD = last.close < 10 ? 0.00012 : last.close < 100 ? 0.0025 : 0.36;
    const digits = last.close < 10 ? 5 : last.close < 100 ? 4 : 2;
    const bid = last.close - SPREAD / 2;
    const ask = last.close + SPREAD / 2;
    const disabled = !!pendingTrade;
    const box = (label, price, color, onClick) => (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
          minWidth: 78, padding: "0.3rem 0.55rem", borderRadius: 6, cursor: disabled ? "default" : "pointer",
          background: "#181A20cc", border: `1.5px solid ${color}`, color,
          fontFamily: "monospace, sans-serif", opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{price.toFixed(digits)}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700 }}>{label}</span>
      </button>
    );
    return (
      <div style={{
        position: "absolute", top: 42, left: 10, zIndex: 8,
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {box("بيع", bid, RED, () => openQuickTrade("sell"))}
        <span style={{ fontSize: 11, color: "#888", padding: "0 2px" }}>{(ask - bid).toFixed(digits)}</span>
        {box("شراء", ask, "#4f7cff", () => openQuickTrade("buy"))}
      </div>
    );
  }

  return (
    <div>
      {!isFullscreen && renderTopBar()}

      {!supported && !error && (
        <div style={{ color: "#f59e0b", fontSize: 13, marginBottom: "1rem" }}>
          ⚠️ هذا الأصل غير مدعوم حالياً بعرض الشموع، اختاري أصل آخر من القائمة.
        </div>
      )}
      {error && <div style={{ color: RED, fontSize: 13, marginBottom: "1rem" }}>{error}</div>}

      {!isFullscreen && renderLiveBadge()}

      <div
        ref={chartWrapperRef}
        style={{
          background: isFullscreen ? "#0a0a08" : "linear-gradient(145deg, #22252B, #181A20)",
          border: `1px solid ${GOLD}26`,
          borderRadius: isFullscreen ? 0 : 14,
          padding: isFullscreen ? "0.6rem" : "1rem",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isFullscreen && (
          <div ref={headerRef} style={{ marginBottom: "0.5rem" }}>
            {renderTopBar()}
            {renderLiveBadge()}
          </div>
        )}

        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#777", fontSize: 14, zIndex: 2, background: "#181A20cc", borderRadius: 14,
          }}>
            ...جاري تحميل البيانات
          </div>
        )}
        {/* صف أفقي خارجي: شريط الأدوات عمود ثابت يمتد على كامل ارتفاع منطقة الشارت
            (اللوحة الرئيسية + القاسم + لوحة المقارنة سوا) بالظبط متل تريدنغ فيو،
            مش محصور بارتفاع اللوحة الرئيسية لحالها. الترتيب هون (المحتوى أولاً
            بالـ DOM ثم الشريط) مقصود: الصفحة كلها RTL، فبهيك ترتيب الشريط بيضل
            ثابت عالشمال دايماً من غير ما نضطر نقلب اتجاه أي نص عربي جوا الشارت. */}
        <div style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0, gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0 }}>
            {/* اللوحة الرئيسية - ارتفاعها الفعلي مضبوط مباشرة بالبكسل من JS (mainPaneRef)
                عشان يضل مطابق تماماً لارتفاع الشارت نفسه (overflow:hidden هون بيمنعه
                من "يفلت" ويسيب فراغ أسود تحت الشارت) */}
            <div
              ref={mainPaneRef}
              style={{ display: maximizedPane === "compare" ? "none" : "flex", flexDirection: "column", flex: "0 0 auto", minHeight: 0, overflow: "hidden", position: "relative" }}
            >
              <div ref={chartAreaRef} style={{ position: "relative", width: "100%", height: "100%", flex: 1, minWidth: 0 }}>
                {!loading && allCandles.length > 0 && !editDraft && chartSettings.ohlcVisible !== false && renderOHLCTicker()}
                {!loading && allCandles.length > 0 && !editDraft && renderFavoritesBar()}
                {!loading && allCandles.length > 0 && !editDraft && renderQuickTradeWidget()}
                {!loading && allCandles.length > 0 && renderPropertiesDialog()}
                {!loading && allCandles.length > 0 && renderSelectionToolbar()}
                {!loading && renderTradePanel()}
                {!loading && renderOpenPositionsPanel()}
                {!loading && renderTradeToast()}
                {!loading && renderContextMenu()}
                {compareOpen && (
                  <div style={paneCornerBadgeStyle("right")}>
                    <button onClick={() => toggleMaximizePane("main")} style={paneCornerBtnStyle} title={maximizedPane === "main" ? "استعادة العرض المقسوم" : "تكبير هاي اللوحة (أو دبل-كليك على القاسم)"}>
                      {maximizedPane === "main" ? "⤡" : "⤢"}
                    </button>
                  </div>
                )}
                {!loading && allCandles.length > 0 && activeIndicators.length > 0 && renderActiveIndicatorsBar()}
                {indicatorPanelOpen && renderIndicatorPanel()}
                {indicatorSettingsFor && renderIndicatorSettingsDialog()}
                {templatesPanelOpen && renderTemplatesPanel()}
                {practicePanelOpen && renderPracticePanel()}
                <div
                  ref={chartContainerRef}
                  style={{ width: "100%", height: "100%", cursor: cutMode ? "crosshair" : activeTool !== "cursor" ? "crosshair" : "default" }}
                />
                <canvas
                  ref={overlayCanvasRef}
                  style={{
                    position: "absolute", inset: 0, zIndex: 3,
                    pointerEvents: (activeTool === "cursor" && !cutMode) ? "none" : "auto",
                  }}
                />
                <div
                  ref={priceTagRef}
                  style={{
                    position: "absolute", right: 0, transform: "translateY(-50%)",
                    display: "none", flexDirection: "column", alignItems: "flex-end",
                    padding: "3px 8px", borderRadius: "4px 0 0 4px", zIndex: 4,
                    pointerEvents: "none", minWidth: 70, fontFamily: "monospace, sans-serif",
                  }}
                >
                  <span data-role="symbol" style={{ fontSize: 10, fontWeight: 700, color: "#181A20" }} />
                  <span data-role="price" style={{ fontSize: 13, fontWeight: 800, color: "#181A20", lineHeight: 1.2 }} />
                  <span data-role="countdown" style={{ fontSize: 10, color: "#181A20aa", display: "none" }} />
                </div>
              </div>
            </div>

            {/* قاسم قابل للسحب لتكبير/تصغير لوحة المقارنة (زي تريدنغ فيو بالظبط) - اسحبيه لفوق/تحت،
                أو دبل-كليك عليه يرجّع النسبة الافتراضية */}
            {compareOpen && !maximizedPane && (
              <div
                onMouseDown={onDividerMouseDown}
                onDoubleClick={() => { compareHeightPxRef.current = DEFAULT_COMPARE_HEIGHT; setCompareHeightPx(DEFAULT_COMPARE_HEIGHT); chartRef.current?.__resize?.(); }}
                title="اسحبي لتكبير/تصغير لوحة المقارنة، أو دبل-كليك للرجوع للحجم الافتراضي"
                style={dividerStyle}
              >
                <span style={dividerGripStyle} />
              </div>
            )}

            {/* لوحة المقارنة: رمز ثاني للقراءة فقط، بدون أدوات رسم، مزامَنة سكرول/زوم مع اللوحة الرئيسية.
                نفس سطح الشارت الرئيسي بالضبط (بدون حدود/زوايا مدوّرة) عشان تبان لوحة وحدة متصلة زي تريدنغ فيو */}
            {compareOpen && (
              <div
                ref={comparePaneRef}
                style={{ display: maximizedPane === "main" ? "none" : "flex", flexDirection: "column", flex: "0 0 auto", minHeight: 0, overflow: "hidden", position: "relative" }}
              >
                <div style={paneCornerBadgeStyle()}>
                  <span>🔀</span>
                  <select
                    value={compareSymbol}
                    onChange={(e) => setCompareSymbol(e.target.value)}
                    style={{ ...selectStyle, minWidth: 130, padding: "0.2rem 0.4rem", fontSize: 11.5, background: "#0000" }}
                  >
                    {ASSETS.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((it) => (
                          <option key={it.v} value={it.v} disabled={!it.yahoo}>{it.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {compareLoading && <span style={{ fontSize: 11, color: "#888" }}>...جاري التحميل</span>}
                  {compareError && <span style={{ fontSize: 11, color: RED }}>{compareError}</span>}
                  <button onClick={() => setCompareSettingsOpen(true)} style={paneCornerBtnStyle} title="إعدادات لوحة المقارنة (نوع الشارت والألوان)">⚙️</button>
                  <button onClick={() => toggleMaximizePane("compare")} style={paneCornerBtnStyle} title={maximizedPane === "compare" ? "استعادة العرض المقسوم" : "تكبير هاي اللوحة (أو دبل-كليك على القاسم)"}>
                    {maximizedPane === "compare" ? "⤡" : "⤢"}
                  </button>
                  <button onClick={toggleCompare} style={paneCornerBtnStyle} title="إغلاق لوحة المقارنة">✕</button>
                </div>
                <div ref={compareContainerRef} style={{ width: "100%", height: "100%", flex: 1, minHeight: 0 }} />
                {renderCompareSettingsDialog()}
              </div>
            )}
          </div>
          {!loading && allCandles.length > 0 && renderDrawToolbar()}
        </div>
        {renderSettingsDialog()}

        {/* طبقة "اضغط برا لتقفل" لقائمة الكليك اليمين: لازم تكون *جوا* chartWrapperRef
            (مش بعده كأخ منفصل بالشجرة) لأنه لما الشارت يفتح بوضع "شاشة كاملة" عن طريق
            Fullscreen API الحقيقي (requestFullscreen على chartWrapperRef نفسه)، المتصفح
            ما بيعرض إلا العناصر يلي هي فعلياً جوا الـ subtree تبع العنصر المفعّل
            fullscreen - أي عنصر برا هاد الـ subtree (متل ما كانت هاي الطبقة سابقاً)
            ما بينعرض ولا بياخد أي كليك إطلاقاً، فالقائمة كانت تضل عالقة لما تكوني
            بوضع الشاشة الكاملة وتنقري بمكان فاضي. نقلها لجوا هون بيخليها تشتغل صح
            بكل الحالتين (شاشة كاملة أو عادي) مع الحفاظ على نفس سلوك position:fixed
            (بيتموضع دايماً بالنسبة للـ viewport بغض النظر عن مكانه بالشجرة). */}
        {contextMenu && (
          <div
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); openContextMenuAt(e.clientX, e.clientY); }}
            style={{ position: "fixed", inset: 0, zIndex: 19 }}
          />
        )}
      </div>

      {openToolGroup !== null && (
        <div
          onClick={() => setOpenToolGroup(null)}
          style={{ position: "fixed", inset: 0, zIndex: 24 }}
        />
      )}

      {mode === "training" && !isFullscreen && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem", fontSize: 12.5, color: "#777" }}>
          <span>الشموع الظاهرة: {revealCount} / {allCandles.length}</span>
          {finished && <span style={{ color: GOLD_LIGHT }}>خلصت الشموع — دوسي "بداية عشوائية جديدة" لجولة تانية 🎯</span>}
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#999" }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

const selectStyle = {
  background: "#181A20", border: "1px solid #2A2E39", color: "#eee",
  borderRadius: 8, padding: "0.45rem 0.6rem", fontSize: 13, minWidth: 110,
};

const numFieldLabelStyle = {
  display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5, color: "#999",
};

function tabStyle(active) {
  return {
    padding: "0.5rem 1rem", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${GOLD}44`,
    background: active ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
    color: active ? "#1a1608" : GOLD,
  };
}

function toolBtnStyle(active) {
  return {
    width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8, cursor: "pointer",
    border: "1px solid transparent",
    background: active ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})` : "transparent",
    color: active ? "#1a1608" : "#c8c8c8",
    transition: "background .12s, color .12s",
    flexShrink: 0,
  };
}

const selToolBtnStyle = {
  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
  background: "none", border: "none", borderRadius: 6, color: "#ccc", cursor: "pointer", fontSize: 14,
};
const selToolDivider = { width: 1, height: 18, background: "#333", margin: "0 2px", flexShrink: 0 };
const templateMenuItemStyle = {
  padding: "9px 14px", cursor: "pointer", fontSize: 13, color: "#e5e5e5",
};

function paneCornerBadgeStyle(side) {
  return {
    position: "absolute", top: 8, [side === "right" ? "right" : "left"]: 8, zIndex: 6,
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(13,13,10,0.72)", backdropFilter: "blur(2px)",
    border: `1px solid ${GOLD}22`, borderRadius: 6,
    padding: "0.2rem 0.45rem", fontSize: 12, fontWeight: 700, color: "#ddd",
    pointerEvents: "auto",
  };
}
const paneCornerBtnStyle = {
  background: "none", border: "none", color: GOLD_LIGHT,
  cursor: "pointer", fontSize: 13, padding: "0 0.15rem", lineHeight: 1,
};
/* أزرار القائمة السريعة (عين/إعدادات/حذف) يلي بتنفتح تحت شريحة المؤشر */
const quickMenuBtnStyle = {
  width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
  background: "none", border: "none", borderRadius: 5, color: "#ccc", cursor: "pointer",
};
/* القاسم القابل للسحب بين الشارت الرئيسي ولوحة المقارنة - سطح واحد متصل بدون فراغ، زي تريدنغ فيو بالظبط */
const dividerStyle = {
  height: 10, flexShrink: 0, cursor: "row-resize",
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent",
};
const dividerGripStyle = {
  width: 40, height: 3, borderRadius: 3, background: `${GOLD}55`,
};

function btnStyle(kind) {
  const base = { padding: "0.55rem 1rem", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none" };
  if (kind === "primary") return { ...base, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, color: "#1a1608" };
  return { ...base, background: "transparent", border: `1px solid ${GOLD}44`, color: GOLD };
}
