"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Sparkles, RotateCcw, ChevronDown, ChevronRight, Zap, Bell, Radio, Brain, Eye, TrendingUp, TrendingDown, Target, CircleCheck as CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";
import { ASSETS, getAssetByValue } from "@/lib/assets";
import { analyzeSymbol, getCorrelatedSymbol } from "@/lib/qais/engine";
import { createClient } from "@/lib/supabase-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/* ============================================================================
   MarketIntelligenceView — "Qais Market Intelligence" — لوحة القيادة الرئيسية
   يشتغل عليها QAIS SK Engine (lib/qais/engine.js) بشكل مباشر وحي، وهي المصدر
   الوحيد اللي بيحسب كل شي هون: الشارت + لوحة التحليل + الأربع كروت تحت +
   ملخص السوق + الإشعارات. لا أرقام وهمية — كل قيمة إما محسوبة لحظياً من
   analyzeSymbol()، أو جايه من /api/radar (نفس المحرك، محفوظ بالكرون)، أو من
   /api/market-intelligence (Yahoo Finance فعلي).
   ============================================================================ */

const GOLD = "#E8B86D";
const GOLD_LIGHT = "#F0C588";
const GREEN = "#3DBB6E";
const RED = "#E5484D";
const BLUE = "#3D8BFD";
const AMBER = "#F5A623";
const NEUTRAL = "#c9c9c9";
const CHART_H = 600;
const ANIM_MS = 450;

const glass = {
  background: "linear-gradient(145deg, rgba(34,37,43,0.9), rgba(20,22,26,0.92))",
  border: `1px solid ${GOLD}22`,
  borderRadius: 16,
  boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
  backdropFilter: "blur(10px)",
};

const TF_LABELS = { m5: "M5", m15: "M15", h1: "H1", h4: "H4", daily: "D1" };
const TF_TOOLBAR_ORDER = ["m5", "m15", "h1", "h4", "daily"];
const YAHOO_OVERRIDE = { XAUEUR: "XAUEUR=X" };

async function fetchCandles(yahoo, interval, count = 5000) {
  try {
    const res = await fetch(`/api/replay-candles?symbol=${encodeURIComponent(yahoo)}&interval=${interval}&count=${count}`);
    const data = await res.json();
    return data.candles || [];
  } catch {
    return [];
  }
}

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

/* -------------------- الجلسات (UTC) — نفس الأوقات المعتمدة عالمياً --------------------
   أربع جلسات كاملة (Sydney/Tokyo/London/New York). Sydney بتلف منتصف الليل
   (21:00 → 06:00 UTC) فمنعاملها كنطاق "ملفوف" في كل الحسابات تحت. */
const SESSION_DEFS = [
  { key: "sydney", label: "Sydney", short: "SYD", start: 21, end: 6, color: "#E8B86D" },
  { key: "tokyo", label: "Tokyo", short: "TOK", start: 0, end: 9, color: GOLD },
  { key: "london", label: "London", short: "LON", start: 7, end: 16, color: BLUE },
  { key: "newyork", label: "New York", short: "NY", start: 12, end: 21, color: GREEN },
];

/* أي جلستين متلاقيتين = أعلى سيولة باليوم، وبالأخص London + New York */
const OVERLAP_DEFS = [
  { keys: ["london", "newyork"], label: "London + New York", liquidity: "Very High" },
  { keys: ["tokyo", "london"], label: "Tokyo + London", liquidity: "High" },
  { keys: ["sydney", "tokyo"], label: "Sydney + Tokyo", liquidity: "Medium" },
];

/* محتوى تعليمي ثابت لكل جلسة — هاد يلي بيتعبى بكروت الشرح تحت الخط الزمني */
const SESSION_INFO = {
  sydney: { liquidity: "Low", volatility: "Low", behaviour: "Quiet, narrow ranges", recommendation: "Avoid new trend trades — wait for Tokyo/London to build direction." },
  tokyo: { liquidity: "Medium", volatility: "Medium", behaviour: "Asia range building", recommendation: "Trade the range and fade extremes; save breakouts for London." },
  london: { liquidity: "Very High", volatility: "High", behaviour: "Trend Expansion", recommendation: "Trade pullbacks with the trend." },
  newyork: { liquidity: "High", volatility: "High", behaviour: "News-driven continuation or reversal", recommendation: "Watch US news releases; follow or fade the London trend with confirmation." },
  off: { liquidity: "Very Low", volatility: "Very Low", behaviour: "Thin, illiquid, wider spreads", recommendation: "Avoid opening new trades — wait for a major session to open." },
};

/* هل الساعة h ضمن نطاق الجلسة s؟ بيدعم النطاقات الملفوفة لمنتصف الليل (start > end) */
function isSessionActive(s, h) {
  return s.start < s.end ? h >= s.start && h < s.end : h >= s.start || h < s.end;
}

export function getSessionsStatus() {
  const h = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  return SESSION_DEFS.map((s) => ({ ...s, active: isSessionActive(s, h) }));
}

/* أفضل تداخل مطابق (لو أي جلستين نشطتين بنفس الوقت)، وإلا null */
export function getActiveOverlap(sessions) {
  const activeKeys = sessions.filter((s) => s.active).map((s) => s.key);
  if (activeKeys.length < 2) return null;
  return OVERLAP_DEFS.find((o) => o.keys.every((k) => activeKeys.includes(k))) || null;
}

export function getPrimarySession(sessions) {
  const overlap = getActiveOverlap(sessions);
  if (overlap) return `${overlap.label} Overlap`;
  const active = sessions.find((s) => s.active);
  if (active) return active.label;
  return "Off-Hours";
}

/* فرق الوقت (بالساعات) من now لغاية target، بيلف لليوم التالي لو الفرق سالب */
function hoursUntil(target, now) {
  let diff = target - now;
  if (diff <= 0) diff += 24;
  return diff;
}

function hoursLabel(h, t) {
  const totalMin = Math.max(0, Math.round(h * 60));
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh <= 0) return t("radar.minShort", { n: mm });
  if (mm === 0) return t("radar.hourShort", { n: hh });
  return t("radar.hourMinShort", { n: hh, m: mm });
}

/* الجلسة النشطة هلأ (يل
